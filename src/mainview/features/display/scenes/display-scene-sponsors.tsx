import { DisplaySceneLayout } from "../components/display-scene-layout";
import { DisplaySceneSponsorLogos } from "../components/display-scene-sponsor-logos";

interface DisplaySceneSponsorsProps {
  eventName: string;
}

export const DisplaySceneSponsors = ({
  eventName,
}: DisplaySceneSponsorsProps): JSX.Element => (
  <DisplaySceneLayout
    ariaLabel={`${eventName} sponsors scene`}
    title="Nhà tài trợ"
  >
    <h1 className="display-sponsors-title">Nhà tài trợ</h1>
    <DisplaySceneSponsorLogos />
  </DisplaySceneLayout>
);
