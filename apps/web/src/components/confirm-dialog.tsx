import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { ReactNode } from 'react';

export function ConfirmDialog({
  action,
  children,
  description,
  onConfirm,
  onOpenChange,
  open,
  title,
}: {
  action: string;
  children?: ReactNode;
  description: string;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  title: string;
}) {
  return (
    <AlertDialog onOpenChange={onOpenChange} open={open}>
      <AlertDialogContent size='sm'>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {children}
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} variant='destructive'>
            {action}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
