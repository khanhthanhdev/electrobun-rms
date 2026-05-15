interface DisplaySceneBlankProps {
  eventName: string;
}

export const DisplaySceneBlank = ({
  eventName,
}: DisplaySceneBlankProps): JSX.Element => (
  <div className="display-scene display-scene-blank display-scene-fullscreen">
    {/* Blank scene - just background, no header or footer */}
  </div>
);
