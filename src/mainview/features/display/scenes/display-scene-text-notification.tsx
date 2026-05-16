import { DisplaySceneLayout } from "../components/display-scene-layout";

interface DisplaySceneTextNotificationProps {
  eventName: string;
  message: string;
}

export const DisplaySceneTextNotification = ({
  eventName,
  message = "Wait for next match",
}: DisplaySceneTextNotificationProps): JSX.Element => (
  <DisplaySceneLayout
    ariaLabel={`${eventName} text notification scene`}
    className="display-scene-text-notification"
    mainClassName="display-scene-center"
    title="Notification"
  >
    <div className="display-text-notification-box">
      <p>{message || "Wait for next match"}</p>
    </div>
  </DisplaySceneLayout>
);
