"use client";

import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { Button } from "../ui/button";
import { FieldWrap, Input, Textarea } from "../ui/field";
import { Loader } from "../ui/loader";
import { PageHeader } from "../ui/page-header";
import { panFromGst, readJson, writeJson } from "./api";

type BusinessProfile = {
  address?: string;
  business_name: string;
  city?: string;
  country?: string;
  email?: string;
  gst?: string;
  mobile?: string;
  owner_name?: string;
  pan?: string;
  state?: string;
};

type UserProfile = {
  display_name: string;
  email?: string;
  mobile?: string;
};

type PasswordForm = {
  currentPassword: string;
  newPassword: string;
};

const emptyBusiness: BusinessProfile = {
  business_name: "",
  country: "India",
};

const emptyUser: UserProfile = {
  display_name: "",
};

export function ProfileForm() {
  const [business, setBusiness] = useState<BusinessProfile>(emptyBusiness);
  const [user, setUser] = useState<UserProfile>(emptyUser);
  const [password, setPassword] = useState<PasswordForm>({ currentPassword: "", newPassword: "" });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([readJson<Record<string, unknown>>("/api/profile/business"), readJson<Record<string, unknown>>("/api/profile/me")])
      .then(([businessRows, userRows]) => {
        setBusiness(normalizeBusiness(businessRows[0] ?? {}));
        setUser(normalizeUser(userRows[0] ?? {}));
      })
      .finally(() => setLoading(false));
  }, []);

  function updateBusiness(key: keyof BusinessProfile, value: string) {
    setBusiness((current) => {
      const next = { ...current, [key]: value };
      if (key === "gst") {
        next.gst = value.toUpperCase().replace(/\s/g, "");
        const pan = panFromGst(next.gst);
        if (pan) next.pan = pan;
      }
      if (key === "pan") next.pan = value.toUpperCase().replace(/\s/g, "");
      return next;
    });
  }

  async function save() {
    setSaving(true);
    try {
      await Promise.all([
        writeJson("/api/profile/business", "PUT", toBusinessPayload(business)),
        writeJson("/api/profile/me", "PUT", toUserPayload(user)),
      ]);
      setMessage("Profile saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save profile.");
    }
    setSaving(false);
  }

  async function changePassword() {
    if (!password.currentPassword || password.newPassword.length < 8) {
      setMessage("Enter your current password and a new password with at least 8 characters.");
      return;
    }

    setSaving(true);
    try {
      await writeJson("/api/auth/change-password", "POST", password);
      setPassword({ currentPassword: "", newPassword: "" });
      setMessage("Password changed.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to change password.");
    }
    setSaving(false);
  }

  return (
    <>
      <PageHeader
        actions={
          <Button isLoading={saving} onClick={save}>
            <Save className="h-4 w-4" />
            Save Profile
          </Button>
        }
        eyebrow="Account"
        title="Profile"
      />
      <section className="grid gap-5 p-4 sm:p-6 lg:grid-cols-[1.3fr_0.7fr] lg:p-8">
        {message ? <div className="rounded-md border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 lg:col-span-2">{message}</div> : null}
        {loading ? <div className="lg:col-span-2"><Loader label="Loading profile..." /></div> : null}
        {!loading ? (
          <>
        <form className="grid gap-4 rounded-lg border border-zinc-200 bg-white p-5" onSubmit={(event) => event.preventDefault()}>
          <h2 className="text-base font-semibold text-zinc-950">Business Profile</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <FieldWrap label="Business Name">
              <Input value={business.business_name} onChange={(event) => updateBusiness("business_name", event.target.value)} />
            </FieldWrap>
            <FieldWrap label="Owner Name">
              <Input value={business.owner_name ?? ""} onChange={(event) => updateBusiness("owner_name", event.target.value)} />
            </FieldWrap>
            <FieldWrap label="Mobile">
              <Input value={business.mobile ?? ""} onChange={(event) => updateBusiness("mobile", event.target.value)} />
            </FieldWrap>
            <FieldWrap label="Email">
              <Input type="email" value={business.email ?? ""} onChange={(event) => updateBusiness("email", event.target.value)} />
            </FieldWrap>
            <FieldWrap label="GSTIN">
              <Input maxLength={15} value={business.gst ?? ""} onChange={(event) => updateBusiness("gst", event.target.value)} />
            </FieldWrap>
            <FieldWrap label="PAN">
              <Input maxLength={10} value={business.pan ?? ""} onChange={(event) => updateBusiness("pan", event.target.value)} />
            </FieldWrap>
            <FieldWrap label="City">
              <Input value={business.city ?? ""} onChange={(event) => updateBusiness("city", event.target.value)} />
            </FieldWrap>
            <FieldWrap label="State">
              <Input value={business.state ?? ""} onChange={(event) => updateBusiness("state", event.target.value)} />
            </FieldWrap>
            <FieldWrap label="Country">
              <Input value={business.country ?? "India"} onChange={(event) => updateBusiness("country", event.target.value)} />
            </FieldWrap>
          </div>
          <FieldWrap label="Address">
            <Textarea value={business.address ?? ""} onChange={(event) => updateBusiness("address", event.target.value)} />
          </FieldWrap>
        </form>

        <form className="grid content-start gap-4 rounded-lg border border-zinc-200 bg-white p-5" onSubmit={(event) => event.preventDefault()}>
          <h2 className="text-base font-semibold text-zinc-950">Logged-in User</h2>
          <FieldWrap label="Display Name">
            <Input value={user.display_name} onChange={(event) => setUser({ ...user, display_name: event.target.value })} />
          </FieldWrap>
          <FieldWrap label="Mobile">
            <Input value={user.mobile ?? ""} onChange={(event) => setUser({ ...user, mobile: event.target.value })} />
          </FieldWrap>
          <FieldWrap label="Email">
            <Input type="email" value={user.email ?? ""} onChange={(event) => setUser({ ...user, email: event.target.value })} />
          </FieldWrap>
          <div className="border-t border-zinc-200 pt-4">
            <h3 className="mb-3 text-sm font-semibold text-zinc-950">Change Password</h3>
            <div className="grid gap-4">
              <FieldWrap label="Current Password">
                <Input
                  type="password"
                  value={password.currentPassword}
                  onChange={(event) => setPassword({ ...password, currentPassword: event.target.value })}
                />
              </FieldWrap>
              <FieldWrap label="New Password">
                <Input
                  minLength={8}
                  type="password"
                  value={password.newPassword}
                  onChange={(event) => setPassword({ ...password, newPassword: event.target.value })}
                />
              </FieldWrap>
              <Button isLoading={saving} onClick={changePassword} variant="secondary">
                Change Password
              </Button>
            </div>
          </div>
        </form>
          </>
        ) : null}
      </section>
    </>
  );
}

function normalizeBusiness(item: Record<string, unknown>): BusinessProfile {
  return {
    address: item.address ? String(item.address) : undefined,
    business_name: String(item.business_name ?? item.businessName ?? ""),
    city: item.city ? String(item.city) : undefined,
    country: String(item.country ?? "India"),
    email: item.email ? String(item.email) : undefined,
    gst: item.gst ? String(item.gst) : undefined,
    mobile: item.mobile ? String(item.mobile) : undefined,
    owner_name: item.owner_name ? String(item.owner_name) : item.ownerName ? String(item.ownerName) : undefined,
    pan: item.pan ? String(item.pan) : undefined,
    state: item.state ? String(item.state) : undefined,
  };
}

function toBusinessPayload(item: BusinessProfile) {
  return {
    address: item.address,
    businessName: item.business_name,
    city: item.city,
    country: item.country,
    email: item.email,
    gst: item.gst,
    mobile: item.mobile,
    ownerName: item.owner_name,
    pan: item.pan,
    state: item.state,
  };
}

function normalizeUser(item: Record<string, unknown>): UserProfile {
  const nestedUser = item.user as Record<string, unknown> | undefined;
  const source = nestedUser ?? item;
  return {
    display_name: String(source.display_name ?? source.displayName ?? ""),
    email: source.email ? String(source.email) : undefined,
    mobile: source.mobile ? String(source.mobile) : undefined,
  };
}

function toUserPayload(item: UserProfile) {
  return {
    displayName: item.display_name,
    email: item.email,
    mobile: item.mobile,
  };
}
