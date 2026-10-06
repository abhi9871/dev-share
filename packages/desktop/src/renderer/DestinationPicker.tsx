import type { DestinationView } from '../shared/ipc.js';

interface DestinationPickerProps {
  readonly destinations: readonly DestinationView[];
  readonly value: string;
  readonly onChange: (name: string) => void;
}

export function DestinationPicker({ destinations, value, onChange }: DestinationPickerProps) {
  return (
    <label className="field">
      <span className="field-label">Destination</span>
      <select
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
        }}
      >
        {value === '' && (
          <option value="" disabled>
            Choose a destination
          </option>
        )}
        {destinations.map((destination) => (
          <option key={destination.name} value={destination.name}>
            {destination.name}
          </option>
        ))}
      </select>
    </label>
  );
}
