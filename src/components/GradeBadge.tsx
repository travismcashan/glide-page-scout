import { type LetterGrade, gradeToColor } from '@/lib/siteScore';

type Props = {
  grade: LetterGrade;
  score: number;
  size?: 'sm' | 'md';
};

export function GradeBadge({ grade, score, size = 'sm' }: Props) {
  const textSize = size === 'sm' ? 'text-[11px]' : 'text-xs';
  return (
    <span className={`inline-flex items-center gap-1 ${textSize} font-semibold ${gradeToColor(grade)} tabular-nums`}>
      {grade} <span className="font-normal text-muted-foreground">· {score}</span>
    </span>
  );
}
