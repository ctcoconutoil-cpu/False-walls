import { Prose } from "@/components/ui/Prose";
export const metadata = { title: "Privacy" };
export default function Privacy() {
  return (
    <Prose title="Privacy" updated="November 2026">
      <p>This is a plain-language summary. Replace it with reviewed legal text before a public launch.</p>
      <h2>What we store</h2>
      <ul>
        <li>Your email (for sign-in only; never shown on your profile), username, display name, avatar, bio and interests.</li>
        <li>Your birth date is used once to place you in an age group (under 18 or adult). Only the group is kept.</li>
        <li>What you post, answer, react to and save, plus the walls you explore, which power badges and trending.</li>
        <li>Reports, blocks and moderation actions.</li>
        <li>Uploaded pictures, re-encoded with location and camera data removed.</li>
      </ul>
      <h2>Anonymity</h2>
      <p>Anonymous questions are hidden from other members and from the person you ask. The service records the sender so abuse can be stopped. Moderators can look up a sender only for reported questions, and each lookup is logged. We cannot promise absolute anonymity.</p>
      <h2>Under 18</h2>
      <p>People under 17 cannot use OpenWalls. Accounts for 17-year-olds are private by default.</p>
      <h2>Your controls</h2>
      <p>Edit your profile and privacy settings, delete your walls and answers, and block or mute people from Settings. Contact the operator to delete your account.</p>
    </Prose>
  );
}
