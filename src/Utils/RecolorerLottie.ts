type ColorProperty = {
  k?: unknown;
};

const isBlack = (color: number[]) => color[0] < 0.04 && color[1] < 0.04 && color[2] < 0.04;

const recolorValue = (value: unknown[], themeColor: number[]) => {
  if (
    typeof value[0] !== 'number' ||
    typeof value[1] !== 'number' ||
    typeof value[2] !== 'number'
  ) return;

  const color = value.slice(0, 3) as number[];
  if (isBlack(color)) return;

  value.splice(0, 4, ...themeColor, typeof value[3] === 'number' ? value[3] : 1);
};

const recolorProperty = (property: ColorProperty, themeColor: number[]) => {
  if (!Array.isArray(property.k)) return;

  if (typeof property.k[0] === 'number') {
    recolorValue(property.k, themeColor);
    return;
  }

  for (const keyframe of property.k) {
    if (!keyframe || typeof keyframe !== 'object') continue;
    const frame = keyframe as { s?: unknown[]; e?: unknown[] };
    if (Array.isArray(frame.s)) recolorValue(frame.s, themeColor);
    if (Array.isArray(frame.e)) recolorValue(frame.e, themeColor);
  }
};

export function recolorerLottie(animationData: unknown, theme: string) {
  const hex = theme.match(/^#([\da-f]{6})$/i)?.[1];
  const themeColor = hex
    ? [0, 2, 4].map((index) => parseInt(hex.slice(index, index + 2), 16) / 255)
    : [0.2, 0.8, 0.8];

  const visit = (value: unknown): void => {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }

    const object = value as Record<string, unknown>;
    if (object.c && typeof object.c === 'object') {
      recolorProperty(object.c as ColorProperty, themeColor);
    }
    if (object.ty === 2 && object.v && typeof object.v === 'object') {
      recolorProperty(object.v as ColorProperty, themeColor);
    }

    Object.values(object).forEach(visit);
  };

  visit(animationData);
  return animationData;
}
