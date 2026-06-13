import React from 'react';

type ProgressTone = 'accent' | 'cta' | 'success' | 'error' | 'upload';

const indicatorToneClass: Record<ProgressTone, string> = {
  accent: 'bg-gradient-to-r from-indigo-500 to-violet-500',
  cta: 'bg-cta',
  success: 'bg-success',
  error: 'bg-error',
  upload: 'bg-gradient-to-r from-indigo-500 via-violet-500 to-emerald-400',
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(Math.max(value, min), max);
}

export interface ProgressBarProps {
  value: number;
  min?: number;
  max?: number;
  ariaLabel: string;
  className?: string;
  indicatorClassName?: string;
  tone?: ProgressTone;
  trackClassName?: string;
}

export function ProgressBar({
  value,
  min = 0,
  max = 100,
  ariaLabel,
  className,
  indicatorClassName,
  tone = 'accent',
  trackClassName,
}: ProgressBarProps) {
  const safeMax = max > min ? max : min + 1;
  const clampedValue = clamp(value, min, safeMax);
  const percent = ((clampedValue - min) / (safeMax - min)) * 100;

  return (
    <div
      className={cx('w-full overflow-hidden rounded-full bg-bg-overlay', className, trackClassName)}
      role="progressbar"
      aria-label={ariaLabel}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={Math.round(clampedValue)}
    >
      <div
        className={cx('h-full rounded-full transition-[width] duration-200 ease-out', indicatorToneClass[tone], indicatorClassName)}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

interface LabeledProgressBarProps extends ProgressBarProps {
  label: React.ReactNode;
  valueLabel?: React.ReactNode;
  hideValueLabel?: boolean;
  labelClassName?: string;
  rowClassName?: string;
  valueClassName?: string;
}

export function LabeledProgressBar({
  label,
  value,
  valueLabel,
  hideValueLabel,
  labelClassName,
  rowClassName,
  valueClassName,
  ...progressProps
}: LabeledProgressBarProps) {
  return (
    <div>
      <div className={cx('flex items-center justify-between gap-3', rowClassName)}>
        <span className={cx('font-semibold', labelClassName)}>{label}</span>
        {!hideValueLabel ? (
          <span className={cx('shrink-0 font-mono text-xs font-black', valueClassName)}>
            {valueLabel ?? `${Math.round(value)}%`}
          </span>
        ) : null}
      </div>
      <ProgressBar value={value} {...progressProps} />
    </div>
  );
}
