import { type LetterGrade, gradeToColor, gradeToBgColor } from '@/lib/siteScore';

type Props = {
  grade: LetterGrade;
  score: number;
  size?: 'sm' | 'md';
};

export function GradeBadge({ grade, score, size = 'sm' }: Props) {
  if (size === 'md') {
    return (
      <span className={`inline-flex items-center gap-1.5 text-base font-bold rounded-full border px-3 py-0.5 ${gradeToBgColor(grade)} ${gradeToColor(grade)} tabular-nums`}>
        {grade} <span className="font-medium text-sm">{score}%</span>
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold ${gradeToColor(grade)} tabular-nums`}>
      {grade} <span className="font-normal text-muted-foreground">· {score}%</span>
    </span>
  );
}
