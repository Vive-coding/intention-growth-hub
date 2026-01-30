
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { User, Shield, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import type { User as UserType } from "@shared/schema";
import { useState, useEffect } from "react";
import { apiRequest } from "@/lib/queryClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const ProfileScreen = () => {
  const { user, isLoading } = useAuth();
  const typedUser = user as UserType | undefined;

  const [firstName, setFirstName] = useState(typedUser?.firstName || "");
  const [lastName, setLastName] = useState(typedUser?.lastName || "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiRequest('/api/users/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName, lastName }),
      });
      window.location.reload();
    } catch (e) {
      console.error('Failed updating profile', e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 pb-24 max-w-md mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Account</h1>
        <p className="text-gray-600">Manage your profile details</p>
      </div>

      {/* Profile Header */}
      <Card className="mb-6 shadow-md border-0 bg-gradient-to-r from-green-50 to-blue-50">
        <CardContent className="p-6 text-center">
          <div className="w-20 h-20 bg-gradient-to-br from-green-500 to-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <User className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-1">
            {isLoading ? "Loading..." :
             (typedUser?.firstName && typedUser?.lastName ? `${typedUser.firstName} ${typedUser.lastName}` : typedUser?.email || "User")}
          </h2>
          <p className="text-gray-600 mb-1">
            Member since {typedUser?.createdAt ? new Date(typedUser.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : 'Recently'}
          </p>
        </CardContent>
      </Card>

      {/* Account form */}
      <Card className="mb-6 shadow-md border-0 bg-white/80 backdrop-blur-sm">
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="firstName">First name</Label>
              <Input id="firstName" value={firstName} onChange={(e)=> setFirstName(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="lastName">Last name</Label>
              <Input id="lastName" value={lastName} onChange={(e)=> setLastName(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Email</Label>
            <Input value={typedUser?.email || ''} disabled />
          </div>
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving || (!firstName && !lastName)}>{saving ? 'Saving…' : 'Save changes'}</Button>
          </div>
        </CardContent>
      </Card>

      {/* Model Preferences */}
      <ModelPreferencesCard />

      {/* Privacy blurb retained */}
      <Card className="mb-6 shadow-md border-0 bg-blue-50">
        <CardContent className="p-4">
          <div className="flex items-center space-x-3">
            <Shield className="w-8 h-8 text-blue-600" />
            <div>
              <h3 className="font-semibold text-gray-800">Your Privacy Matters</h3>
              <p className="text-sm text-gray-600">All your data is encrypted and secure. You have complete control over your information.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Logout */}
      <Button 
        variant="outline" 
        className="w-full py-3 rounded-full text-red-600 border-red-200 hover:bg-red-50"
        onClick={()=>{ localStorage.removeItem('user'); localStorage.removeItem('token'); window.location.reload(); }}
      >
        <LogOut className="w-4 h-4 mr-2" />
        Log Out
      </Button>
    </div>
  );
};

function ModelPreferencesCard() {
  const queryClient = useQueryClient();
  const [selectedModel, setSelectedModel] = useState<string>("gpt-5-mini");

  const { data: preferences, isLoading, error } = useQuery({
    queryKey: ["/api/user/preferences/model"],
    queryFn: async () => {
      const data = await apiRequest("/api/user/preferences/model");
      return data as { preferredModel: string; isPremium: boolean };
    },
  });

  useEffect(() => {
    if (preferences?.preferredModel) {
      setSelectedModel(preferences.preferredModel);
    }
  }, [preferences]);

  const updateMutation = useMutation({
    mutationFn: async (model: string) => {
      await apiRequest("/api/user/preferences/model", {
        method: "PUT",
        body: JSON.stringify({ model }),
      });
      return { model };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/preferences/model"] });
    },
  });

  const handleModelChange = (model: string) => {
    if (model === "claude-opus" && !preferences?.isPremium) {
      alert("Claude Opus 4.5 requires a premium subscription. Please upgrade to access this model.");
      return;
    }
    setSelectedModel(model);
    updateMutation.mutate(model);
  };

  if (isLoading) {
    return (
      <Card className="mb-6 shadow-md border-0 bg-white/80 backdrop-blur-sm">
        <CardHeader>
          <CardTitle>AI Model Preferences</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600">Loading model preferences...</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="mb-6 shadow-md border-0 bg-red-50">
        <CardHeader>
          <CardTitle>AI Model Preferences</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-red-600">Error loading preferences. Please refresh the page.</p>
          <p className="text-xs text-red-500 mt-2">{String(error)}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mb-6 shadow-md border-0 bg-white/80 backdrop-blur-sm">
      <CardHeader>
        <CardTitle>AI Model Preferences</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="model">Default Model</Label>
          <p className="text-xs text-gray-500 mb-2">Choose your preferred AI model for new conversations</p>
          <Select value={selectedModel} onValueChange={handleModelChange} disabled={updateMutation.isPending}>
            <SelectTrigger id="model">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="gpt-5-mini">GPT-5 Mini (Free)</SelectItem>
              <SelectItem value="claude-haiku">Claude Haiku 4.5 (Free)</SelectItem>
              <SelectItem value="claude-opus" disabled={!preferences?.isPremium}>
                Claude Opus 4.5 {!preferences?.isPremium && "(Premium Required)"}
              </SelectItem>
            </SelectContent>
          </Select>
          {selectedModel === "claude-haiku" && (
            <p className="text-xs text-blue-600 mt-2 flex items-center gap-1">
              <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">Fast</span>
              Quick responses with Claude intelligence
            </p>
          )}
          {selectedModel === "claude-opus" && (
            <p className="text-xs text-purple-600 mt-2 flex items-center gap-1">
              <span className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-700">Premium</span>
              Most advanced reasoning and capabilities
            </p>
          )}
        </div>
        {!preferences?.isPremium && (
          <div className="text-xs text-gray-500 p-2 bg-gray-50 rounded">
            Upgrade to premium to access Claude Opus for more advanced AI capabilities.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
