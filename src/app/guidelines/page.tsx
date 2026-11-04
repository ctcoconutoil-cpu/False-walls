import { Prose } from "@/components/ui/Prose";
export const metadata = { title: "Community guidelines" };
export default function Guidelines() {
  return (
    <Prose title="Community guidelines" updated="November 2026">
      <p>False Walls is for curiosity and honest conversation. These rules keep the Wall safe to explore.</p>
      <h2>Not allowed</h2>
      <ul>
        <li>Harassment, threats, hate or targeting a person or group.</li>
        <li>Trying to work out who sent an anonymous question, or exposing someone who did.</li>
        <li>Sharing private contact details, addresses or other personal information, yours or anyone else&apos;s.</li>
        <li>Sexual content involving minors, or any sexual content aimed at under-18s.</li>
        <li>Spam, repeated posts, scams and unsolicited links.</li>
        <li>Content that promotes self-harm or dangerous acts.</li>
      </ul>
      <h2>Anonymous questions</h2>
      <p>Anonymous questions hide your name from the person you ask. They are not absolutely anonymous: if a question is reported, moderators can look up the sender to stop abuse, and that lookup is logged. Abusive anonymous senders are suspended.</p>
      <h2>Your tools</h2>
      <p>You can report, block or mute from any wall, answer or profile. Blocking an anonymous sender works without revealing who they are. Reports go to a moderation queue; walls that many established members report are hidden while they are reviewed.</p>
      <h2>Under 18</h2>
      <p>You must be 17 or older. Accounts for under-18s start private, are not listed in search, and cannot receive anonymous questions.</p>
      <h2>What moderators can do</h2>
      <p>Remove content, suspend accounts, and keep a log of each action. Sample content marked as demo is placed by the False Walls team to show how the Wall works.</p>
    </Prose>
  );
}
