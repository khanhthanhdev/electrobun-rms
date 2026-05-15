import { DisplaySceneFooter } from "../components/display-scene-footer";
import { DisplaySceneHeader } from "../components/display-scene-header";

interface DisplaySceneTextNotificationProps {
  eventName: string;
  message: string;
}

export const DisplaySceneTextNotification = ({
  eventName,
  message = "Wait for next match",
}: DisplaySceneTextNotificationProps): JSX.Element => (
  <section
    aria-label={`${eventName} text notification scene`}
    className="display-sponsors-scene display-scene-text-notification"
  >
    <DisplaySceneHeader title="Notification" />

    <main className="display-sponsors-main display-scene-center">
      <div className="display-text-notification-box">
        <p>{message || "Wait for next match"}</p>
      </div>
    </main>

    <DisplaySceneFooter />
  </section>
);
