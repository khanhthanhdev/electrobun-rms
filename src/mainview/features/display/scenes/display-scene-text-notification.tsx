import { DisplayChrome } from "../display-chrome";

interface DisplaySceneTextNotificationProps {
  eventName: string;
  message: string;
}

export const DisplaySceneTextNotification = ({
  eventName,
  message = "Wait for next match",
}: DisplaySceneTextNotificationProps): JSX.Element => (
  <DisplayChrome eventName={eventName}>
    <div className="display-scene display-scene-text-notification">
      <div className="display-scene-center">
        <div className="display-text-notification-box">
          <p>{message || "Wait for next match"}</p>
        </div>
      </div>
    </div>
  </DisplayChrome>
);
