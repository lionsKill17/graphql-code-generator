import {
  DocumentNode,
  Kind,
  DefinitionNode,
  FieldDefinitionNode,
  InputValueDefinitionNode,
  NamedTypeNode,
  TypeNode,
  Source,
} from 'graphql';
import { normalize, sep } from 'path';

const separator = '/';

/**
 * Searches every node to collect used types
 */
export function collectUsedTypes(doc: DocumentNode): string[] {
  const used: string[] = [];

  doc.definitions.forEach(findRelated);

  function markAsUsed(type: string) {
    if (!used.includes(type)) {
      used.push(type);
    }
  }

  function findRelated(node: DefinitionNode | FieldDefinitionNode | InputValueDefinitionNode | NamedTypeNode) {
    if (node.kind === Kind.OBJECT_TYPE_DEFINITION || node.kind === Kind.OBJECT_TYPE_EXTENSION) {
      // Object
      markAsUsed(node.name.value);

      if (node.fields) {
        node.fields.forEach(findRelated);
      }

      if (node.interfaces) {
        node.interfaces.forEach(findRelated);
      }
    } else if (node.kind === Kind.INPUT_OBJECT_TYPE_DEFINITION || node.kind === Kind.INPUT_OBJECT_TYPE_EXTENSION) {
      // Input
      markAsUsed(node.name.value);

      if (node.fields) {
        node.fields.forEach(findRelated);
      }
    } else if (node.kind === Kind.INTERFACE_TYPE_DEFINITION || node.kind === Kind.INTERFACE_TYPE_EXTENSION) {
      // Interface
      markAsUsed(node.name.value);

      if (node.fields) {
        node.fields.forEach(findRelated);
      }

      if (node.interfaces) {
        node.interfaces.forEach(findRelated);
      }
    } else if (node.kind === Kind.UNION_TYPE_DEFINITION || node.kind === Kind.UNION_TYPE_EXTENSION) {
      // Union
      markAsUsed(node.name.value);

      if (node.types) {
        node.types.forEach(findRelated);
      }
    } else if (node.kind === Kind.ENUM_TYPE_DEFINITION || node.kind === Kind.ENUM_TYPE_EXTENSION) {
      // Enum
      markAsUsed(node.name.value);
    } else if (node.kind === Kind.SCALAR_TYPE_DEFINITION || node.kind === Kind.SCALAR_TYPE_EXTENSION) {
      // Scalar
      if (!isGraphQLPrimitive(node.name.value)) {
        markAsUsed(node.name.value);
      }
    } else if (node.kind === Kind.INPUT_VALUE_DEFINITION) {
      // Argument
      findRelated(resolveTypeNode(node.type));
    } else if (node.kind === Kind.FIELD_DEFINITION) {
      // Field
      findRelated(resolveTypeNode(node.type));

      if (node.arguments) {
        node.arguments.forEach(findRelated);
      }
    } else if (node.kind === Kind.NAMED_TYPE) {
      // Named type
      if (!isGraphQLPrimitive(node.name.value)) {
        markAsUsed(node.name.value);
      }
    }
  }

  return used;
}

export function resolveTypeNode(node: TypeNode): NamedTypeNode {
  if (node.kind === Kind.LIST_TYPE) {
    return resolveTypeNode(node.type);
  }

  if (node.kind === Kind.NON_NULL_TYPE) {
    return resolveTypeNode(node.type);
  }

  return node;
}

function isGraphQLPrimitive(name: string) {
  return ['String', 'Boolean', 'ID', 'Float', 'Int'].includes(name);
}

export function unique<T>(val: T, i: number, all: T[]): boolean {
  return i === all.indexOf(val);
}

export function withQuotes(val: string): string {
  return `'${val}'`;
}

export function indent(size: number) {
  const space = new Array(size).fill(' ').join('');

  return (val: string) => `${space}${val}`;
}

export function groupSourcesByModule(sources: Source[], basePath: string): Record<string, Source[]> {
  const grouped: Record<string, Source[]> = {};

  sources.forEach(source => {
    // PERF: we could guess the module by matching source.location with a list of already resolved paths
    const mod = extractModuleDirectory(source.name, basePath);

    if (!grouped[mod]) {
      grouped[mod] = [];
    }

    grouped[mod].push(source);
  });

  return grouped;
}

function extractModuleDirectory(filepath: string, basePath: string): string {
  const [, relativePath] = normalize(filepath).split(normalize(ensureDirSeparatorAtEnd(basePath)));
  const [moduleDirectory] = relativePath.replace(sep, separator).split(separator);

  return moduleDirectory;
}

export function stripFilename(path: string) {
  return path.substring(0, path.lastIndexOf(separator));
}

function ensureDirSeparatorAtEnd(path: string) {
  return path.endsWith(separator) ? path : path + separator;
}
