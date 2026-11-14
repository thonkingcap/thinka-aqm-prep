// What an API key is and where a Babson student finds theirs. Shown wherever the key is pasted.
export default function KeyHelp({ id }: { id?: string }) {
  return (
    <div id={id} className="key-help">
      <p><strong>What's an API key?</strong> Every Babson freshman gets $100 of Claude credit. To find yours, search <strong>"Claude API"</strong> in Outlook: there's an email from Ian Cox with a key that starts with <code>sk-</code>.</p>
      <p>Paste that key here to chat with a Claude tutor that knows the notes Dr. Phil taught us. It also marks your written answers and builds custom practice sets. Everything else on the site works without a key.</p>
    </div>
  );
}
