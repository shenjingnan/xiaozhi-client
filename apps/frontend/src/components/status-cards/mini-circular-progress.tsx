/**
 * 迷你圆形进度条组件
 *
 * 用于在状态卡片中显示进度或状态的圆形进度条。
 * 支持自定义颜色、尺寸、最大值等属性。
 */

/**
 * MiniCircularProgress 组件的属性接口
 */
export interface MiniCircularProgressProps {
  /** 是否显示数值 */
  showValue?: boolean;
  /** 当前进度值 */
  value?: number;
  /** 最大值（用于计算进度百分比） */
  maxValue?: number;
  /** 组件尺寸（像素） */
  size?: number;
  /** 激活状态的颜色（十六进制或CSS颜色值） */
  activeColor?: string;
  /** 未激活状态的颜色（十六进制或CSS颜色值） */
  inactiveColor?: string;
  /** 数值后缀符号（如 "%"） */
  symbol?: string;
  /** 可访问性标签 */
  ariaLabel?: string;
}

/**
 * 迷你圆形进度条组件
 *
 * @param props - 组件属性
 * @returns JSX 元素
 *
 * @example
 * ```tsx
 * <MiniCircularProgress
 *   value={75}
 *   maxValue={100}
 *   activeColor="#16a34a"
 *   inactiveColor="#e5e7eb"
 *   size={60}
 * />
 * ```
 */
export function MiniCircularProgress({
  showValue = true,
  value = 0,
  maxValue = 100,
  size = 60,
  activeColor = "#3b82f6",
  inactiveColor = "#e5e7eb",
  symbol = "%",
  ariaLabel,
}: MiniCircularProgressProps) {
  const radius = (size - 6) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDasharray = circumference;
  // 防止除零错误，当maxValue为0时，将strokeDashoffset设为circumference（显示为空）
  const strokeDashoffset =
    maxValue === 0
      ? circumference
      : circumference - (value / maxValue) * circumference;

  return (
    <div
      className="relative inline-flex items-center justify-center"
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={maxValue}
      aria-label={ariaLabel || `进度：${value}/${maxValue}`}
    >
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={inactiveColor}
          strokeWidth={6}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={activeColor}
          strokeWidth={6}
          fill="none"
          strokeDasharray={strokeDasharray}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="transition-all duration-300 ease-in-out"
        />
      </svg>
      {showValue && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs font-medium">
            {value}
            {symbol}
          </span>
        </div>
      )}
    </div>
  );
}
