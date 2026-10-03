import { AccountDetailsForm } from "./account-details-form";
import { ChangePasswordSection } from "./change-password-section";

interface ProfileSettingsPanelProps {
  email: string;
  username: string | null;
  dateOfBirth: string | null;
  hasPassword: boolean;
}

export function ProfileSettingsPanel({
  email,
  username,
  dateOfBirth,
  hasPassword
}: ProfileSettingsPanelProps) {
  return (
    <section
      id="profile-settings-panel"
      className="animate-rise-in space-y-6 rounded-2xl border border-border bg-card p-5 sm:p-6"
    >
      <div>
        <p className="text-sm font-medium text-muted-foreground">Account</p>
        <h2 className="text-title mt-2">Settings</h2>
      </div>

      <div className="space-y-1 border-t border-border pt-5">
        <p className="text-sm font-medium text-muted-foreground">Email</p>
        <p className="text-base font-medium text-foreground">{email}</p>
      </div>

      <div className="border-t border-border pt-5">
        <AccountDetailsForm username={username} dateOfBirth={dateOfBirth} />
      </div>

      <div className="border-t border-border pt-5">
        <ChangePasswordSection hasPassword={hasPassword} email={email} />
      </div>
    </section>
  );
}
