import { DisplaySceneLayout } from "../components/display-scene-layout";

interface DisplaySceneBlankProps {
  eventName: string;
}

export const DisplaySceneBlank = ({
  eventName,
}: DisplaySceneBlankProps): JSX.Element => (
  <DisplaySceneLayout
    ariaLabel={`${eventName} blank scene`}
    className="display-scene-blank"
    mainClassName="display-scene-center"
    title={eventName}
  />
);
