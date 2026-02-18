import { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Camera } from "lucide-react";
import { authApi } from "../../api/auth.js";
import { useAuthStore } from "../../stores/auth.js";
import { Button, Input } from "../ui/index.js";

export default function ProfileTab() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const fileRef = useRef<HTMLInputElement>(null);

  // Avatar
  const [avatarLoading, setAvatarLoading] = useState(false);

  // Bank identifiers
  const [sber, setSber] = useState(user?.sberAccountNumber ?? "");
  const [tbankCard, setTbankCard] = useState(user?.tbankCardCode ?? "");
  const [tbankDeposit, setTbankDeposit] = useState(user?.tbankDepositContract ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Password
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [pwLoading, setPwLoading] = useState(false);
  const [pwMsg, setPwMsg] = useState("");
  const [pwError, setPwError] = useState("");

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarLoading(true);
    try {
      const updated = await authApi.uploadAvatar(file);
      setUser(updated);
    } catch {
      // silent
    } finally {
      setAvatarLoading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleSaveBankIds() {
    setSaving(true);
    try {
      const updated = await authApi.updateProfile({
        sberAccountNumber: sber || null,
        tbankCardCode: tbankCard || null,
        tbankDepositContract: tbankDeposit || null,
      });
      setUser(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  async function handleChangePassword() {
    setPwLoading(true);
    setPwMsg("");
    setPwError("");
    try {
      await authApi.changePassword({ currentPassword: currentPw, newPassword: newPw });
      setPwMsg(t("profile.passwordChanged"));
      setCurrentPw("");
      setNewPw("");
    } catch (err) {
      setPwError(err instanceof Error ? err.message : t("profile.passwordError"));
    } finally {
      setPwLoading(false);
    }
  }

  const initials = user?.name
    ? user.name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2)
    : "?";

  return (
    <div className="profile-tab">
      {/* Avatar */}
      <div className="profile-section profile-avatar-section">
        <div className="profile-avatar" onClick={() => fileRef.current?.click()}>
          {user?.avatar ? (
            <img src={user.avatar} alt="" className="profile-avatar__img" />
          ) : (
            <span className="profile-avatar__initials">{initials}</span>
          )}
          <div className="profile-avatar__overlay">
            <Camera size={20} />
          </div>
          {avatarLoading && <div className="profile-avatar__loading" />}
        </div>
        <div className="profile-avatar__info">
          <div className="profile-avatar__name">{user?.name}</div>
          <div className="profile-avatar__email">{user?.email}</div>
        </div>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={handleAvatarChange} />
      </div>

      {/* Bank Identifiers */}
      <div className="profile-section">
        <h3 className="profile-section__title">{t("profile.bankIds")}</h3>
        <p className="profile-section__hint">{t("profile.bankIdsHint")}</p>
        <div className="profile-fields">
          <Input
            label={t("profile.sberAccount")}
            value={sber}
            onChange={(e) => setSber(e.target.value)}
            placeholder={t("profile.sberPlaceholder")}
          />
          <Input
            label={t("profile.tbankCard")}
            value={tbankCard}
            onChange={(e) => setTbankCard(e.target.value)}
            placeholder={t("profile.tbankCardPlaceholder")}
          />
          <Input
            label={t("profile.tbankDeposit")}
            value={tbankDeposit}
            onChange={(e) => setTbankDeposit(e.target.value)}
            placeholder={t("profile.tbankDepositPlaceholder")}
          />
        </div>
        <Button onClick={handleSaveBankIds} loading={saving}>
          {saved ? t("profile.saved") : t("common.save")}
        </Button>
      </div>

      {/* Password Change */}
      <div className="profile-section">
        <h3 className="profile-section__title">{t("profile.changePassword")}</h3>
        <div className="profile-fields">
          <Input
            label={t("profile.currentPassword")}
            type="password"
            value={currentPw}
            onChange={(e) => setCurrentPw(e.target.value)}
          />
          <Input
            label={t("profile.newPassword")}
            type="password"
            value={newPw}
            onChange={(e) => setNewPw(e.target.value)}
          />
        </div>
        {pwMsg && <div className="profile-success">{pwMsg}</div>}
        {pwError && <div className="wizard-error">{pwError}</div>}
        <Button
          onClick={handleChangePassword}
          loading={pwLoading}
          disabled={!currentPw || newPw.length < 6}
        >
          {t("profile.changePasswordBtn")}
        </Button>
      </div>
    </div>
  );
}
