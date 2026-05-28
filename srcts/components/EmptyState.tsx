import { Card, CardContent } from "@/components/ui/card";

interface EmptyStateProps {
  title: string;
  description?: string;
}

export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <Card className='border-paper-edge bg-paper'>
      <CardContent className='py-12 text-center'>
        <p className='font-display text-2xl tracking-wider text-ink'>
          {title}
        </p>
        {description && (
          <p className='text-sm text-ink-soft mt-2 max-w-sm mx-auto'>
            {description}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
