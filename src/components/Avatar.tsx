import { assetUrl } from '../assets';

interface Props { name: string; avatar?: string; color?: number; small?: boolean }

const references: Record<string, { source: string; viewBox: string; width: number; height: number }> = {
  'ref:corporate': { source: 'mobile', viewBox: '491 163 54 54', width: 1360, height: 1360 },
  'ref:arina': { source: 'mobile', viewBox: '422 308 48 48', width: 1360, height: 1360 },
  'ref:ivan': { source: 'mobile', viewBox: '422 446 48 48', width: 1360, height: 1360 },
  'ref:alexandra': { source: 'mobile', viewBox: '422 989 48 48', width: 1360, height: 1360 },
  'ref:mikhail': { source: 'desktop', viewBox: '483 99 36 36', width: 1266, height: 784 },
};

export function demoSenderAvatar(name?: string) {
  return name === 'Арина Громова' ? 'ref:arina' : name === 'Иван Игнатьев' ? 'ref:ivan' : name === 'Александра' ? 'ref:alexandra' : undefined;
}

export function Avatar({ name, avatar, color = 0, small = false }: Props) {
  const initials = name.replace(/^\+/, '').split(/\s+/).filter(Boolean).slice(0, 2).map(word => word[0]).join('').toUpperCase();
  const reference = references[avatar || ''];
  return <span className={`avatar avatar-${color} ${small ? 'avatar-small' : ''} ${reference ? 'avatar-photo' : avatar ? 'avatar-emoji' : ''}`} aria-hidden="true">{reference
    ? <svg viewBox={reference.viewBox} width="100%" height="100%"><image href={assetUrl(`reference-${reference.source}.png`)} width={reference.width} height={reference.height} /></svg>
    : avatar === 'max' ? <img src={assetUrl('max-logo.png')} alt="" /> : avatar?.startsWith('ref:') ? initials : avatar || initials}</span>;
}
