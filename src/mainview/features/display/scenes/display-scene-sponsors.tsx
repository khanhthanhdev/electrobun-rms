import { DisplayChrome } from "../display-chrome";

interface DisplaySceneSponsorsProps {
  eventName: string;
}

export const DisplaySceneSponsors = ({
  eventName,
}: DisplaySceneSponsorsProps): JSX.Element => (
  <DisplayChrome eventName={eventName}>
    <div className="display-scene display-scene-sponsors">
      <div className="display-scene-center">
        <h2 className="display-sponsors-title">Nhà tài trợ</h2>
        <div aria-hidden="true" className="display-sponsors-logos">
          {/* Placeholder for sponsor logos */}
        </div>
      </div>
    </div>
  </DisplayChrome>
);
