export default function GameLayout() {
  return (
    <div>
      <div className="flex justify-between">
        <p>lobby code goes here</p>
        <p>round phase here</p>
        <p>visual of the phases here</p>
        <img src={ava} />
        <p>{me?.name}</p>
      </div>
    </div>
  );
}
