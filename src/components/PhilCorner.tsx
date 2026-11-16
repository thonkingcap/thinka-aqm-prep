// Dr Phil with his cup of tea, in the top corner of a page, with a short line in a speech bubble.
import DrPhil from "./DrPhil.tsx";

export default function PhilCorner({ line }: { line: string }) {
  return (
    <div className="head-phil" aria-hidden="true">
      <span className="phil-bubble">{line}</span>
      <DrPhil tea size={76} className="page-drphil" />
    </div>
  );
}
