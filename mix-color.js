#!/usr/bin/env node

/**
 * USAGE: node mix-color.js <HEX>
 * Example: node mix-color.js 232B3A
 */

const RESET = '\x1b[0m'
const BOLD = '\x1b[1m'

const BLUE = '\x1b[38;2;86;156;214m'
const GREEN = '\x1b[38;2;181;206;168m'
const ORANGE = '\x1b[38;2;206;145;120m'
const SOFT = '\x1b[38;2;200;200;200m'
const NOTICE = '\x1b[38;2;255;214;102m'

const fg = (r, g, b) => `\x1b[38;2;${r};${g};${b}m`
const bg = (r, g, b) => `\x1b[48;2;${r};${g};${b}m`

function hexToRgb255(hex) {
  const clean = hex.replace('#', '')
  return {
    r: parseInt(clean.substring(0, 2), 16),
    g: parseInt(clean.substring(2, 4), 16),
    b: parseInt(clean.substring(4, 6), 16),
  }
}

const targetHex = process.argv[2]

if (!targetHex) {
  console.log('Usage: node mix-color.js <HEX>')
  process.exit(1)
}

const rgb255 = hexToRgb255(targetHex)

function printSwatch({ r, g, b }) {
  const block = bg(r, g, b) + '        ' + RESET
  console.log(`${block}  #${targetHex.toUpperCase()}`)
}

// --- Academia Color Ingredients ---
const recipe = {
  surfaceActual: { r: 0.08627, g: 0.08627, b: 0.08627 }, // #161616
  dominantActual: { r: 0.0, g: 0.38039, b: 1.0 }, // #0061FF
  dominantVivid: { r: 0.0, g: 0.0, b: 1.0 }, // #0000FF
  surfaceContra: { r: 1.0, g: 1.0, b: 1.0 }, // #FFFFFF
  pureBlack: { r: 0.0, g: 0.0, b: 0.0 }, // #000000
}

function hexToRgb(hex) {
  const cleanHex = hex.replace('#', '')
  const r = parseInt(cleanHex.substring(0, 2), 16) / 255
  const g = parseInt(cleanHex.substring(2, 4), 16) / 255
  const b = parseInt(cleanHex.substring(4, 6), 16) / 255
  return { r, g, b }
}

function rgbToHex({ r, g, b }) {
  const toHex = (value) =>
    Math.round(Math.min(1, Math.max(0, value)) * 255)
      .toString(16)
      .padStart(2, '0')
      .toUpperCase()

  return `${toHex(r)}${toHex(g)}${toHex(b)}`
}

function solveLinearSystem(matrix, vector) {
  const size = matrix.length
  const a = matrix.map((row) => row.slice())
  const b = vector.slice()

  for (let pivot = 0; pivot < size; pivot++) {
    let maxRow = pivot

    for (let row = pivot + 1; row < size; row++) {
      if (Math.abs(a[row][pivot]) > Math.abs(a[maxRow][pivot])) {
        maxRow = row
      }
    }

    if (Math.abs(a[maxRow][pivot]) < 1e-12) {
      return null
    }

    ;[a[pivot], a[maxRow]] = [a[maxRow], a[pivot]]
    ;[b[pivot], b[maxRow]] = [b[maxRow], b[pivot]]

    const pivotValue = a[pivot][pivot]
    for (let col = pivot; col < size; col++) {
      a[pivot][col] /= pivotValue
    }
    b[pivot] /= pivotValue

    for (let row = 0; row < size; row++) {
      if (row === pivot) continue

      const factor = a[row][pivot]
      for (let col = pivot; col < size; col++) {
        a[row][col] -= factor * a[pivot][col]
      }
      b[row] -= factor * b[pivot]
    }
  }

  return b
}

function dot(a, b) {
  return a.r * b.r + a.g * b.g + a.b * b.b
}

function findBestMix(target) {
  const ingredients = [
    ['surfaceActual', recipe.surfaceActual],
    ['dominantActual', recipe.dominantActual],
    ['dominantVivid', recipe.dominantVivid],
    ['surfaceContra', recipe.surfaceContra],
    ['pureBlack', recipe.pureBlack],
  ]

  let best = null

  for (let mask = 1; mask < 1 << ingredients.length; mask++) {
    const active = []

    for (let i = 0; i < ingredients.length; i++) {
      if (mask & (1 << i)) {
        active.push(ingredients[i])
      }
    }

    const count = active.length
    const matrix = Array.from({ length: count + 1 }, () =>
      Array(count + 1).fill(0),
    )
    const vector = Array(count + 1).fill(0)

    for (let row = 0; row < count; row++) {
      for (let col = 0; col < count; col++) {
        matrix[row][col] = 2 * dot(active[row][1], active[col][1])
      }
      matrix[row][count] = 1
      vector[row] = 2 * dot(active[row][1], target)
    }

    for (let col = 0; col < count; col++) {
      matrix[count][col] = 1
    }
    vector[count] = 1

    const solution = solveLinearSystem(matrix, vector)
    if (!solution) continue

    const weights = solution.slice(0, count)
    if (weights.some((weight) => weight < -1e-9)) continue

    const mixed = { r: 0, g: 0, b: 0 }
    for (let i = 0; i < count; i++) {
      const [, color] = active[i]
      mixed.r += color.r * weights[i]
      mixed.g += color.g * weights[i]
      mixed.b += color.b * weights[i]
    }

    const err = Math.sqrt(
      Math.pow(target.r - mixed.r, 2) +
        Math.pow(target.g - mixed.g, 2) +
        Math.pow(target.b - mixed.b, 2),
    )

    if (!best || err < best.err) {
      const namedWeights = {
        surfaceActual: 0,
        dominantActual: 0,
        dominantVivid: 0,
        surfaceContra: 0,
        pureBlack: 0,
      }

      for (let i = 0; i < count; i++) {
        namedWeights[active[i][0]] = Math.max(0, weights[i])
      }

      best = {
        ...namedWeights,
        mixed,
        err,
      }
    }
  }

  return best
}

const target = hexToRgb(targetHex)
const result = findBestMix(target)
const accuracy = Math.max(0, 100 - result.err * 100)
const matchedHex = rgbToHex(result.mixed)
const isExact = result.err < 1e-5

// --- OUTPUT ---
const line = '─'.repeat(50)

console.log('\n' + BOLD + line + RESET)
console.log(BOLD + ' COLOR MATCH RESULT ' + RESET)
console.log(BOLD + line + RESET + '\n')

printSwatch(rgb255)

console.log(`${BOLD}Accuracy:${RESET} ${accuracy.toFixed(4)}%`)
console.log(`${BOLD}Matched:${RESET}  #${matchedHex}`)

if (!isExact) {
  console.log(
    `${NOTICE}Target is outside the current ingredient gamut; this is the exact best fit.${RESET}`,
  )
}

console.log('\n' + SOFT + 'Mix Weights' + RESET)
console.log('')

function row(label, value) {
  const padded = label.padEnd(18, ' ')
  console.log(`${padded} ${value.toFixed(4)}f`)
}

row('dominantActual', result.dominantActual)
row('dominantVivid', result.dominantVivid)
row('surfaceContra', result.surfaceContra)
row('pureNeutral', result.pureBlack)

console.log('\n' + SOFT + 'Generated Call' + RESET)
console.log('')

console.log(`${BLUE}deriveColor${RESET}(`)
console.log(
  `  ${ORANGE}dominantActual${RESET} = ${GREEN}${result.dominantActual.toFixed(4)}f${RESET},`,
)
console.log(
  `  ${ORANGE}dominantVivid${RESET}  = ${GREEN}${result.dominantVivid.toFixed(4)}f${RESET},`,
)
console.log(
  `  ${ORANGE}surfaceContra${RESET}  = ${GREEN}${result.surfaceContra.toFixed(4)}f${RESET},`,
)
console.log(
  `  ${ORANGE}pureNeutral${RESET}    = ${GREEN}${result.pureBlack.toFixed(4)}f${RESET}`,
)
console.log(')')
