import React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { View } from 'react-native';

import { palette } from './tokens';

/**
 * Quortiv mark — a bold "Q": a solid dark ring with an electric-blue tail
 * rising through the lower-right. Vector so it stays crisp and adapts to dark mode.
 */
export function LogoMark({ size = 40, ring, slash }: { size?: number; ring?: string; slash?: string }) {
  const s = size;
  return (
    <Svg width={s} height={s} viewBox="0 0 48 48" fill="none">
      {/* Solid Q ring */}
      <Circle
        cx={21.5}
        cy={21}
        r={14}
        stroke={ring || palette.navy700}
        strokeWidth={7}
        fill="none"
      />
      {/* Electric-blue rising tail (parallelogram) crossing the lower-right edge */}
      <Path
        d="M30.2 23.8 L43.2 36.8 L36.8 43.2 L23.8 30.2 Z"
        fill={slash || palette.blue500}
      />
    </Svg>
  );
}

export function LogoLockup({
  size = 30,
  color = palette.navy700,
  slash = palette.blue500,
  children,
}: {
  size?: number;
  color?: string;
  slash?: string;
  children?: React.ReactNode;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: size * 0.28 }}>
      <LogoMark size={size} ring={color} slash={slash} />
      {children}
    </View>
  );
}

/** Decorative background glyph used on onboarding / empty states. */
export function LogoGlow({ size = 220, color = palette.blue500, opacity = 0.09 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 200 200" style={{ opacity }}>
      <Circle cx={100} cy={100} r={98} fill={color} opacity={0.35} />
      <Circle cx={100} cy={100} r={64} fill={color} opacity={0.5} />
      <Rect x={86} y={40} width={28} height={120} rx={14} fill={color} transform="rotate(35 100 100)" />
    </Svg>
  );
}
