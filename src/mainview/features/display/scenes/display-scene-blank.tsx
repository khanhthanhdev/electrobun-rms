import { DisplayChrome } from "../display-chrome";

interface DisplaySceneBlankProps {
  eventName: string;
}

export const DisplaySceneBlank = ({
  eventName,
}: DisplaySceneBlankProps): JSX.Element => (
  <DisplayChrome eventName={eventName}>
    <div className="display-scene display-scene-blank">
      <div aria-hidden="true" className="display-scene-center">
        {/* Minimal standby - event logo/clock area placeholder */}
      </div>
    </div>
  </DisplayChrome>
);
