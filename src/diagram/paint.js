export const NODE_STYLE_PAINT_FIELDS = Object.freeze(["fill", "stroke", "accent", "text"]);

const NAMED_COLORS = (
  "aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown "
  + "burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan "
  + "darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange darkorchid "
  + "darkred darksalmon darkseagreen darkslateblue darkslategray darkslategrey darkturquoise darkviolet "
  + "deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro "
  + "ghostwhite gold goldenrod gray green greenyellow grey honeydew hotpink indianred indigo ivory khaki "
  + "lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan lightgoldenrodyellow lightgray "
  + "lightgreen lightgrey lightpink lightsalmon lightseagreen lightskyblue lightslategray lightslategrey "
  + "lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine mediumblue mediumorchid "
  + "mediumpurple mediumseagreen mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue "
  + "mintcream mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid palegoldenrod "
  + "palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple rebeccapurple "
  + "red rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue slateblue "
  + "slategray slategrey snow springgreen steelblue tan teal thistle tomato transparent turquoise violet wheat "
  + "white whitesmoke yellow yellowgreen currentcolor none"
).split(" ");

function caseInsensitiveLiteral(value) {
  return [...value].map((character) => {
    const lower = character.toLowerCase();
    const upper = character.toUpperCase();
    return lower === upper ? character : `[${lower}${upper}]`;
  }).join("");
}

// Keep this grammar browser-independent: allowing a browser CSS parser here would
// also allow external references such as url(), var(), and future unsafe syntax.
// Decimal tokens are bounded to values JavaScript can keep finite. Scientific
// notation uses a normalized mantissa and a safe exponent range; this preserves
// the established finite exponent syntax without admitting Infinity.
const DECIMAL = String.raw`(?:\d{1,308}(?:\.\d+)?|\.\d+)`;
const SAFE_POSITIVE_EXPONENT = String.raw`\+?0*(?:\d{1,2}|[12]\d{2}|30[0-7])`;
const SCIENTIFIC = String.raw`(?:\d(?:\.\d+)?|\.\d+)[eE](?:-\d+|${SAFE_POSITIVE_EXPONENT})`;
const NUMBER = String.raw`[+-]?(?:${SCIENTIFIC}|${DECIMAL})`;
const PERCENTAGE = `${NUMBER}%`;
const NUMBER_OR_PERCENTAGE = `${NUMBER}%?`;
const HUE = `${NUMBER}(?:${["deg", "grad", "rad", "turn"].map(caseInsensitiveLiteral).join("|")})?`;
const ALPHA = NUMBER_OR_PERCENTAGE;
const SPACE = String.raw`\s+`;
const OPTIONAL_SPACE = String.raw`\s*`;
const SLASH_ALPHA = `${OPTIONAL_SPACE}/${OPTIONAL_SPACE}${ALPHA}`;

function functionName(name) {
  return caseInsensitiveLiteral(name);
}

function legacy(name, components) {
  return `${functionName(name)}\\(${OPTIONAL_SPACE}${components.join(`${OPTIONAL_SPACE},${OPTIONAL_SPACE}`)}${OPTIONAL_SPACE}\\)`;
}

function modern(name, components) {
  return `${functionName(name)}\\(${OPTIONAL_SPACE}${components.join(SPACE)}(?:${SLASH_ALPHA})?${OPTIONAL_SPACE}\\)`;
}

const legacyColors = [
  legacy("rgb", [NUMBER, NUMBER, NUMBER]),
  legacy("rgb", [PERCENTAGE, PERCENTAGE, PERCENTAGE]),
  legacy("rgba", [NUMBER, NUMBER, NUMBER, ALPHA]),
  legacy("rgba", [PERCENTAGE, PERCENTAGE, PERCENTAGE, ALPHA]),
  legacy("hsl", [HUE, PERCENTAGE, PERCENTAGE]),
  legacy("hsla", [HUE, PERCENTAGE, PERCENTAGE, ALPHA]),
];

const modernColors = [
  ...["rgb", "rgba", "lab", "oklab"].map((name) => modern(name, [
    NUMBER_OR_PERCENTAGE,
    NUMBER_OR_PERCENTAGE,
    NUMBER_OR_PERCENTAGE,
  ])),
  ...["hsl", "hsla", "hwb"].map((name) => modern(name, [HUE, PERCENTAGE, PERCENTAGE])),
  ...["lch", "oklch"].map((name) => modern(name, [NUMBER_OR_PERCENTAGE, NUMBER_OR_PERCENTAGE, HUE])),
];

const namedColors = NAMED_COLORS.map(caseInsensitiveLiteral).join("|");
const hexColor = String.raw`#[0-9a-fA-F]{3}(?:[0-9a-fA-F](?:[0-9a-fA-F]{2}(?:[0-9a-fA-F]{2})?)?)?`;

export const PAINT_PATTERN_SOURCE = `^${OPTIONAL_SPACE}(?:${hexColor}|${namedColors}|${[
  ...legacyColors,
  ...modernColors,
].join("|")})${OPTIONAL_SPACE}$`;

const PAINT_PATTERN = new RegExp(PAINT_PATTERN_SOURCE);

export const PAINT_JSON_SCHEMA = Object.freeze({
  type: "string",
  pattern: PAINT_PATTERN_SOURCE,
});

export function isSupportedPaint(value) {
  return typeof value === "string" && PAINT_PATTERN.test(value);
}
