/**
 * S-Expression Parser for KiCad Schematics
 * Based on .claude/file-format-analysis.md
 *
 * KiCad uses S-expressions (Lisp-like syntax) for schematics since v6
 */

export interface SExprNode {
  type: 'list' | 'atom' | 'string'
  value?: string
  children?: SExprNode[]
}

export interface Component {
  reference: string
  value: string
  footprint: string
  lib_id: string
  uuid: string
  position: { x: number; y: number; angle: number }
  properties?: Record<string, string>
}

export interface SubcircuitMetadata {
  components: Component[]
  uniqueComponents: Array<{
    lib_id: string
    count: number
    values: string[]
  }>
  nets: Array<{
    name: string
    type: string
  }>
  stats: {
    componentCount: number
    wireCount: number
    netCount: number
  }
  boundingBox: {
    minX: number
    minY: number
    maxX: number
    maxY: number
  }
  footprints: {
    assigned: number
    unassigned: number
    types: string[]
  }
  version?: number
  warnings?: string[]
}

/**
 * Parse S-expression text into a tree structure
 */
export function parseSExpression(sexpr: string): SExprNode {
  let pos = 0

  function parseToken(): SExprNode {
    // Skip whitespace
    while (pos < sexpr.length && /\s/.test(sexpr[pos])) {
      pos++
    }

    if (pos >= sexpr.length) {
      throw new Error('Unexpected end of input')
    }

    // Parse list
    if (sexpr[pos] === '(') {
      pos++ // skip '('
      const children: SExprNode[] = []

      while (true) {
        // Skip whitespace
        while (pos < sexpr.length && /\s/.test(sexpr[pos])) {
          pos++
        }

        if (pos >= sexpr.length) {
          throw new Error('Unclosed list')
        }

        if (sexpr[pos] === ')') {
          pos++ // skip ')'
          break
        }

        children.push(parseToken())
      }

      return { type: 'list', children }
    }

    // Parse quoted string
    if (sexpr[pos] === '"') {
      pos++ // skip '"'
      let value = ''

      while (pos < sexpr.length && sexpr[pos] !== '"') {
        if (sexpr[pos] === '\\' && pos + 1 < sexpr.length) {
          pos++ // skip escape character
        }
        value += sexpr[pos]
        pos++
      }

      if (pos >= sexpr.length) {
        throw new Error('Unclosed string')
      }

      pos++ // skip closing '"'
      return { type: 'string', value }
    }

    // Parse atom (unquoted token)
    let value = ''
    while (pos < sexpr.length && !/[\s()""]/.test(sexpr[pos])) {
      value += sexpr[pos]
      pos++
    }

    return { type: 'atom', value }
  }

  return parseToken()
}

/**
 * Validate KiCad schematic S-expression
 */
export function validateKiCadSchematic(sexpr: string): { valid: boolean; error?: string; version?: number } {
  try {
    const tree = parseSExpression(sexpr)

    // Check root is a list starting with 'kicad_sch'
    if (tree.type !== 'list' || !tree.children || tree.children.length === 0) {
      return { valid: false, error: 'Invalid S-expression structure' }
    }

    const firstChild = tree.children[0]
    if (firstChild.type !== 'atom' || firstChild.value !== 'kicad_sch') {
      return { valid: false, error: 'Not a KiCad schematic file (expected kicad_sch)' }
    }

    // Find version
    let version: number | undefined
    for (const child of tree.children) {
      if (child.type === 'list' && child.children && child.children.length >= 2) {
        const tag = child.children[0]
        if (tag.type === 'atom' && tag.value === 'version') {
          const versionNode = child.children[1]
          if (versionNode.type === 'atom' || versionNode.type === 'string') {
            version = parseInt(versionNode.value || '0', 10)
          }
        }
      }
    }

    // Check version is KiCad 6+ (version >= 20211014)
    if (!version || version < 20211014) {
      return { valid: false, error: 'KiCad 5 or earlier format detected. Please use KiCad 6 or later.' }
    }

    return { valid: true, version }
  } catch (error) {
    return { valid: false, error: error instanceof Error ? error.message : 'Parse error' }
  }
}

/**
 * Extract metadata from parsed S-expression
 */
export function extractMetadata(sexpr: string): SubcircuitMetadata {
  const tree = parseSExpression(sexpr)

  const components: Component[] = []
  const nets: Array<{ name: string; type: string }> = []
  let wireCount = 0
  let version: number | undefined

  function findInList(node: SExprNode, tag: string): SExprNode | undefined {
    if (node.type !== 'list' || !node.children) return undefined
    return node.children.find(child =>
      child.type === 'list' &&
      child.children &&
      child.children[0]?.type === 'atom' &&
      child.children[0]?.value === tag
    )
  }

  function getStringValue(node: SExprNode, tag: string, defaultValue = ''): string {
    const found = findInList(node, tag)
    if (found && found.children && found.children[1]) {
      return found.children[1].value || defaultValue
    }
    return defaultValue
  }

  function traverse(node: SExprNode) {
    if (node.type !== 'list' || !node.children || node.children.length === 0) return

    const tag = node.children[0]
    if (tag.type !== 'atom') return

    switch (tag.value) {
      case 'version':
        if (node.children[1]) {
          version = parseInt(node.children[1].value || '0', 10)
        }
        break

      case 'symbol':
        // Extract component information
        const libId = getStringValue(node, 'lib_id')
        const reference = getStringValue(findInList(node, 'property') || node, 'Reference')
        const value = getStringValue(findInList(node, 'property') || node, 'Value')
        const footprint = getStringValue(findInList(node, 'property') || node, 'Footprint')
        const uuid = getStringValue(node, 'uuid')

        // Extract position from 'at' node
        const atNode = findInList(node, 'at')
        let position = { x: 0, y: 0, angle: 0 }
        if (atNode && atNode.children && atNode.children.length >= 3) {
          position = {
            x: parseFloat(atNode.children[1]?.value || '0'),
            y: parseFloat(atNode.children[2]?.value || '0'),
            angle: parseFloat(atNode.children[3]?.value || '0')
          }
        }

        if (libId) {
          components.push({
            reference,
            value,
            footprint,
            lib_id: libId,
            uuid,
            position
          })
        }
        break

      case 'label':
      case 'global_label':
      case 'hierarchical_label':
        const labelName = node.children[1]?.value || ''
        if (labelName) {
          nets.push({
            name: labelName,
            type: tag.value
          })
        }
        break

      case 'wire':
        wireCount++
        break
    }

    // Recursively process children
    if (node.children) {
      for (const child of node.children) {
        traverse(child)
      }
    }
  }

  traverse(tree)

  // Calculate unique components
  const componentMap = new Map<string, { values: Set<string>; count: number }>()
  for (const comp of components) {
    if (!componentMap.has(comp.lib_id)) {
      componentMap.set(comp.lib_id, { values: new Set(), count: 0 })
    }
    const entry = componentMap.get(comp.lib_id)!
    entry.values.add(comp.value)
    entry.count++
  }

  const uniqueComponents = Array.from(componentMap.entries()).map(([lib_id, data]) => ({
    lib_id,
    count: data.count,
    values: Array.from(data.values)
  }))

  // Calculate bounding box
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const comp of components) {
    minX = Math.min(minX, comp.position.x)
    minY = Math.min(minY, comp.position.y)
    maxX = Math.max(maxX, comp.position.x)
    maxY = Math.max(maxY, comp.position.y)
  }
  if (components.length === 0) {
    minX = minY = maxX = maxY = 0
  }

  // Footprint analysis
  const footprintTypes = new Set<string>()
  let assigned = 0
  for (const comp of components) {
    if (comp.footprint) {
      assigned++
      footprintTypes.add(comp.footprint)
    }
  }

  // Generate warnings
  const warnings: string[] = []
  if (assigned < components.length) {
    warnings.push(`${components.length - assigned} component(s) missing footprint assignments`)
  }

  return {
    components,
    uniqueComponents,
    nets,
    stats: {
      componentCount: components.length,
      wireCount,
      netCount: nets.length
    },
    boundingBox: {
      minX,
      minY,
      maxX,
      maxY
    },
    footprints: {
      assigned,
      unassigned: components.length - assigned,
      types: Array.from(footprintTypes)
    },
    version,
    warnings: warnings.length > 0 ? warnings : undefined
  }
}

/**
 * Add attribution comments to S-expression
 */
export function addAttribution(sexpr: string, options: {
  title: string
  author: string
  url: string
  license: string
}): string {
  // Find the end of the first line (after kicad_sch and version)
  const lines = sexpr.split('\n')
  let insertIndex = 0

  // Find where to insert (after generator or version)
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('(generator ') || lines[i].includes('(version ')) {
      insertIndex = i + 1
      break
    }
  }

  const attribution = [
    `  (title "${options.title}")`,
    `  (comment 1 "Author: ${options.author}")`,
    `  (comment 2 "Source: ${options.url}")`,
    `  (comment 3 "License: ${options.license}")`,
    `  (comment 4 "Downloaded: ${new Date().toISOString().split('T')[0]}")`,
    ''
  ].join('\n')

  lines.splice(insertIndex, 0, attribution)
  return lines.join('\n')
}
