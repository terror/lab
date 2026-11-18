import { cn } from 'cn';
import { useLayoutEffect, useRef, useState } from 'react';

type Property =
  | 'borderTopLeftRadius'
  | 'transitionDuration'
  | 'transitionTimingFunction';

type Row = { name: string; use: string; value?: string };

function milliseconds(value: string) {
  if (!/^[\d.]+s$/.test(value)) {
    return value;
  }

  return `${Math.round(Number.parseFloat(value) * 1000)}ms`;
}

function Computed({ name, property }: { name: string; property: Property }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [value, setValue] = useState('');

  useLayoutEffect(() => {
    if (ref.current) {
      setValue(milliseconds(getComputedStyle(ref.current)[property]));
    }
  }, [property]);

  return (
    <>
      <span ref={ref} className={cn('hidden', name)} />
      {value}
    </>
  );
}

export function TokenTable({
  property,
  rows,
}: {
  property?: Property;
  rows: Row[];
}) {
  return (
    <table className='w-full text-left text-sm'>
      <thead>
        <tr className='border-b text-xs text-muted-foreground'>
          <th className='py-2 pr-4 font-medium'>Token</th>
          <th className='py-2 pr-4 font-medium'>Value</th>
          <th className='py-2 font-medium'>Use</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(({ name, use, value }) => (
          <tr key={name} className='border-b last:border-b-0'>
            <td className='py-2 pr-4'>
              <code className='text-xs'>{name}</code>
            </td>
            <td className='py-2 pr-4 text-xs whitespace-nowrap text-muted-foreground tabular-nums'>
              {value}
              {!value && property && (
                <Computed name={name} property={property} />
              )}
            </td>
            <td className='py-2'>{use}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
