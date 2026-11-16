import anthropic from '@lobehub/icons-static-svg/icons/anthropic.svg';
import baseten from '@lobehub/icons-static-svg/icons/baseten.svg';
import cerebras from '@lobehub/icons-static-svg/icons/cerebras.svg';
import deepseek from '@lobehub/icons-static-svg/icons/deepseek.svg';
import fireworks from '@lobehub/icons-static-svg/icons/fireworks.svg';
import githubcopilot from '@lobehub/icons-static-svg/icons/githubcopilot.svg';
import google from '@lobehub/icons-static-svg/icons/google.svg';
import groq from '@lobehub/icons-static-svg/icons/groq.svg';
import huggingface from '@lobehub/icons-static-svg/icons/huggingface.svg';
import kimi from '@lobehub/icons-static-svg/icons/kimi.svg';
import meta from '@lobehub/icons-static-svg/icons/meta.svg';
import minimax from '@lobehub/icons-static-svg/icons/minimax.svg';
import mistral from '@lobehub/icons-static-svg/icons/mistral.svg';
import moonshot from '@lobehub/icons-static-svg/icons/moonshot.svg';
import nvidia from '@lobehub/icons-static-svg/icons/nvidia.svg';
import openai from '@lobehub/icons-static-svg/icons/openai.svg';
import opencode from '@lobehub/icons-static-svg/icons/opencode.svg';
import openrouter from '@lobehub/icons-static-svg/icons/openrouter.svg';
import qwen from '@lobehub/icons-static-svg/icons/qwen.svg';
import together from '@lobehub/icons-static-svg/icons/together.svg';
import vercel from '@lobehub/icons-static-svg/icons/vercel.svg';
import xai from '@lobehub/icons-static-svg/icons/xai.svg';
import xiaomimimo from '@lobehub/icons-static-svg/icons/xiaomimimo.svg';
import zai from '@lobehub/icons-static-svg/icons/zai.svg';

const logos: [string, string][] = [
  ['anthropic', anthropic],
  ['baseten', baseten],
  ['cerebras', cerebras],
  ['deepseek', deepseek],
  ['fireworks', fireworks],
  ['github-copilot', githubcopilot],
  ['google', google],
  ['groq', groq],
  ['huggingface', huggingface],
  ['kimi', kimi],
  ['meta', meta],
  ['minimax', minimax],
  ['mistral', mistral],
  ['moonshotai', moonshot],
  ['nvidia', nvidia],
  ['openai', openai],
  ['opencode', opencode],
  ['openrouter', openrouter],
  ['qwen', qwen],
  ['together', together],
  ['vercel', vercel],
  ['xai', xai],
  ['xiaomi', xiaomimimo],
  ['zai', zai],
];

export function ProviderLogo({ id, name }: { id: string; name: string }) {
  const logo = logos.find(([prefix]) => id.startsWith(prefix))?.[1];

  return (
    <span
      aria-hidden='true'
      className='flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted text-sm font-semibold text-muted-foreground'
    >
      {logo ? (
        <span
          className='size-4.5 bg-foreground'
          style={{
            maskImage: `url(${JSON.stringify(logo)})`,
            maskPosition: 'center',
            maskRepeat: 'no-repeat',
            maskSize: 'contain',
          }}
        />
      ) : (
        name.charAt(0)
      )}
    </span>
  );
}
