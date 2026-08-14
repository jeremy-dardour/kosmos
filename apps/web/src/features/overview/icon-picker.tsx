import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

/**
 * A curated grid rather than the OS emoji palette: the palette steals window
 * focus on some Chrome/macOS builds, leaving an inline editor with nothing to
 * insert into. The free-text field covers anything not listed here.
 */
const ICONS = [
  '📋',
  '📝',
  '📅',
  '🗓️',
  '🗒️',
  '📌',
  '📎',
  '🗂️',
  '✅',
  '🎯',
  '📊',
  '📈',
  '📉',
  '🏷️',
  '⏰',
  '⏳',
  '🚀',
  '🔧',
  '🔨',
  '🪛',
  '⚙️',
  '🧰',
  '🧱',
  '🧪',
  '🖥️',
  '💻',
  '📱',
  '⌨️',
  '🔌',
  '🖨️',
  '🌐',
  '🧩',
  '📣',
  '📢',
  '💬',
  '✉️',
  '📨',
  '📞',
  '🔔',
  '📰',
  '🎨',
  '📸',
  '🎬',
  '📺',
  '🖼️',
  '🎧',
  '🎵',
  '🎤',
  '🎪',
  '🎉',
  '🎊',
  '🎈',
  '🎀',
  '🎫',
  '🏆',
  '🥳',
  '🎁',
  '💐',
  '🌸',
  '🕯️',
  '🥂',
  '🍾',
  '⭐',
  '🔥',
  '🎂',
  '🍰',
  '🧁',
  '🍽️',
  '🍷',
  '☕',
  '🍕',
  '🍔',
  '🥗',
  '🍫',
  '🥤',
  '🍳',
  '🌿',
  '🌞',
  '💡',
  '🪴',
  '💍',
  '👰',
  '🤵',
  '👗',
  '👔',
  '👠',
  '💄',
  '🧵',
  '⛪',
  '💒',
  '🏰',
  '🏠',
  '🏨',
  '🛋️',
  '🛏️',
  '🪑',
  '🚿',
  '🧹',
  '🧺',
  '📦',
  '🚚',
  '🚌',
  '🚕',
  '🚲',
  '🚗',
  '✈️',
  '🛳️',
  '🧳',
  '🗺️',
  '🐕',
  '🐾',
  '🔒',
  '💰',
  '💳',
  '🧾',
  '🏦',
  '📑',
  '✍️',
  '⚖️',
  '🔑',
];

interface IconPickerProperties {
  value: string;
  /** Accessible name for the trigger. */
  label: string;
  placeholder?: string;
  id?: string;
  className?: string;
  onSelect: (icon: string) => void;
}

export const IconPicker = ({
  value,
  label,
  placeholder,
  id,
  className,
  onSelect,
}: IconPickerProperties) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [custom, setCustom] = useState('');

  const setOpen = (shouldOpen: boolean) => {
    setIsOpen(shouldOpen);
    if (!shouldOpen) setCustom('');
  };

  const pick = (icon: string) => {
    onSelect(icon);
    setOpen(false);
  };

  return (
    <Popover open={isOpen} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            id={id}
            aria-label={label}
            title={label}
            className={cn(
              '-mx-1 rounded px-1 hover:bg-muted focus-visible:bg-muted',
              !value && 'text-muted-foreground',
              className,
            )}
          />
        }
      >
        {value || placeholder}
      </PopoverTrigger>
      <PopoverContent className="w-auto p-1.5">
        <Input
          value={custom}
          aria-label={t('overview.iconPicker.customLabel')}
          placeholder={t('overview.iconPicker.customPlaceholder')}
          maxLength={16}
          className="mb-1.5 h-7 text-sm"
          onChange={(event) => setCustom(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return;
            // The dialog usage sits inside a <form>; Enter must not submit it.
            event.preventDefault();
            const trimmed = custom.trim();
            if (trimmed) pick(trimmed);
          }}
        />
        <div className="grid max-h-56 grid-cols-8 gap-0.5 overflow-y-auto">
          {ICONS.map((icon) => (
            <button
              key={icon}
              type="button"
              className="flex size-7 items-center justify-center rounded-md text-base hover:bg-accent"
              onClick={() => pick(icon)}
            >
              {icon}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};
