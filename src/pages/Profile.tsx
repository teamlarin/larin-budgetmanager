import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, Loader2, Link2, Unlink, Bell, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Separator } from '@/components/ui/separator';
import { PasswordStrengthIndicator } from '@/components/PasswordStrengthIndicator';
import { z } from 'zod';

// Define notification types with labels
const NOTIFICATION_TYPES = [
  { type: 'project_leader_assigned', label: 'Assegnazione Project Leader', description: 'Quando vieni assegnato come project leader a un progetto' },
  { type: 'activity_assignment', label: 'Assegnazione Attività', description: 'Quando ti viene assegnata una nuova attività' },
  { type: 'budget_pending', label: 'Budget in Attesa', description: 'Quando un budget è in attesa di approvazione' },
  { type: 'budget_approved', label: 'Budget Approvato', description: 'Quando un tuo budget viene approvato' },
  { type: 'budget_rejected', label: 'Budget Rifiutato', description: 'Quando un tuo budget viene rifiutato' },
  { type: 'pack_hours_warning', label: 'Avviso Ore Pack', description: 'Quando un progetto pack raggiunge il 90% delle ore' },
  { type: 'pack_hours_overtime', label: 'Sforamento Ore Pack', description: 'Quando un progetto pack supera le ore previste' },
];

interface NotificationPreference {
  notification_type: string;
  email_enabled: boolean;
  in_app_enabled: boolean;
}

const Profile = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [userProfile, setUserProfile] = useState({
    first_name: '',
    last_name: '',
    email: '',
    avatar_url: '',
    role: '',
    title: '',
    area: '',
  });
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [googleLinked, setGoogleLinked] = useState(false);
  const [linkingGoogle, setLinkingGoogle] = useState(false);
  const [notificationPreferences, setNotificationPreferences] = useState<NotificationPreference[]>([]);
  const [savingPreferences, setSavingPreferences] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    loadProfile();
    checkGoogleLinked();
    loadNotificationPreferences();
  }, []);

  const checkGoogleLinked = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const googleIdentity = user.identities?.find(identity => identity.provider === 'google');
        const hasGoogle = !!googleIdentity;
        setGoogleLinked(hasGoogle);

        // Auto-update avatar with Google avatar if profile has no avatar
        if (hasGoogle && googleIdentity?.identity_data?.avatar_url) {
          const googleAvatar = googleIdentity.identity_data.avatar_url as string;
          
          // Check if profile currently has no avatar
          const { data: profile } = await supabase
            .from('profiles')
            .select('avatar_url')
            .eq('id', user.id)
            .single();

          if (!profile?.avatar_url) {
            // Update profile with Google avatar
            await supabase
              .from('profiles')
              .update({ avatar_url: googleAvatar })
              .eq('id', user.id);

            setUserProfile(prev => ({ ...prev, avatar_url: googleAvatar }));
            toast({
              title: 'Avatar aggiornato',
              description: 'L\'avatar di Google è stato impostato come foto profilo',
            });
          }
        }
      }
    } catch (error) {
      console.error('Error checking Google link:', error);
    }
  };

  const handleLinkGoogle = async () => {
    setLinkingGoogle(true);
    try {
      const { error } = await supabase.auth.linkIdentity({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/profile`,
        },
      });

      if (error) throw error;
    } catch (error: any) {
      console.error('Error linking Google:', error);
      toast({
        title: 'Errore',
        description: error.message || 'Impossibile collegare l\'account Google',
        variant: 'destructive',
      });
      setLinkingGoogle(false);
    }
  };

  const handleUnlinkGoogle = async () => {
    setLinkingGoogle(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Utente non trovato');

      const googleIdentity = user.identities?.find(identity => identity.provider === 'google');
      if (!googleIdentity) throw new Error('Account Google non collegato');

      const { error } = await supabase.auth.unlinkIdentity(googleIdentity);
      if (error) throw error;

      setGoogleLinked(false);
      toast({
        title: 'Account scollegato',
        description: 'L\'account Google è stato scollegato con successo',
      });
    } catch (error: any) {
      console.error('Error unlinking Google:', error);
      toast({
        title: 'Errore',
        description: error.message || 'Impossibile scollegare l\'account Google',
        variant: 'destructive',
      });
    } finally {
      setLinkingGoogle(false);
    }
  };

  const loadNotificationPreferences = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      setUserId(user.id);
      
      const { data, error } = await supabase
        .from('notification_preferences')
        .select('notification_type, email_enabled, in_app_enabled')
        .eq('user_id', user.id);
      
      if (error) throw error;
      
      // Merge with default preferences for types that don't have saved preferences
      const savedPrefs = data || [];
      const allPrefs = NOTIFICATION_TYPES.map(nt => {
        const saved = savedPrefs.find(p => p.notification_type === nt.type);
        return saved || { notification_type: nt.type, email_enabled: true, in_app_enabled: true };
      });
      
      setNotificationPreferences(allPrefs);
    } catch (error) {
      console.error('Error loading notification preferences:', error);
    }
  };

  const updateNotificationPreference = async (
    notificationType: string, 
    field: 'email_enabled' | 'in_app_enabled', 
    value: boolean
  ) => {
    if (!userId) return;
    
    setSavingPreferences(true);
    try {
      // Update local state immediately for responsiveness
      setNotificationPreferences(prev => 
        prev.map(p => 
          p.notification_type === notificationType 
            ? { ...p, [field]: value } 
            : p
        )
      );
      
      // Upsert the preference
      const { error } = await supabase
        .from('notification_preferences')
        .upsert({
          user_id: userId,
          notification_type: notificationType,
          [field]: value,
          // Keep other field value
          ...(field === 'email_enabled' 
            ? { in_app_enabled: notificationPreferences.find(p => p.notification_type === notificationType)?.in_app_enabled ?? true }
            : { email_enabled: notificationPreferences.find(p => p.notification_type === notificationType)?.email_enabled ?? true }
          )
        }, {
          onConflict: 'user_id,notification_type'
        });
      
      if (error) throw error;
      
      toast({
        title: 'Preferenza aggiornata',
        description: 'Le tue preferenze di notifica sono state salvate',
      });
    } catch (error) {
      console.error('Error updating notification preference:', error);
      // Revert on error
      loadNotificationPreferences();
      toast({
        title: 'Errore',
        description: 'Impossibile aggiornare la preferenza',
        variant: 'destructive',
      });
    } finally {
      setSavingPreferences(false);
    }
  };

  const loadProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/auth');
        return;
      }

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('first_name, last_name, email, avatar_url, title, area')
        .eq('id', user.id)
        .single();

      if (error) throw error;

      // Get user role
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();

      if (profile) {
        setUserProfile({
          first_name: profile.first_name || '',
          last_name: profile.last_name || '',
          email: profile.email || user.email || '',
          avatar_url: profile.avatar_url || '',
          role: roleData?.role || '',
          title: profile.title || '',
          area: profile.area || '',
        });
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      toast({
        title: 'Errore',
        description: 'Impossibile caricare il profilo',
        variant: 'destructive',
      });
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      const { error } = await supabase
        .from('profiles')
        .update({
          first_name: userProfile.first_name,
          last_name: userProfile.last_name,
          title: userProfile.title || null,
          area: userProfile.area || null,
        })
        .eq('id', user.id);

      if (error) throw error;

      toast({
        title: 'Profilo aggiornato',
        description: 'Le modifiche sono state salvate con successo',
      });
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({
        title: 'Errore',
        description: 'Impossibile aggiornare il profilo',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      if (!e.target.files || e.target.files.length === 0) {
        return;
      }

      const file = e.target.files[0];

      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        toast({
          title: 'Errore',
          description: 'Solo immagini JPG, PNG, GIF o WebP sono consentite',
          variant: 'destructive',
        });
        return;
      }

      // Validate file size (max 5MB)
      const maxSize = 5 * 1024 * 1024;
      if (file.size > maxSize) {
        toast({
          title: 'Errore',
          description: 'Il file è troppo grande. Dimensione massima: 5MB',
          variant: 'destructive',
        });
        return;
      }

      setUploading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      const fileExt = file.name.split('.').pop();
      const filePath = `${user.id}/avatar.${fileExt}`;

      // Delete old avatar if exists
      if (userProfile.avatar_url) {
        const oldPath = userProfile.avatar_url.split('/').pop();
        if (oldPath) {
          await supabase.storage.from('avatars').remove([`${user.id}/${oldPath}`]);
        }
      }

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', user.id);

      if (updateError) throw updateError;

      setUserProfile({ ...userProfile, avatar_url: publicUrl });

      toast({
        title: 'Foto profilo aggiornata',
        description: 'La tua foto profilo è stata caricata con successo',
      });
    } catch (error) {
      console.error('Error uploading avatar:', error);
      toast({
        title: 'Errore',
        description: 'Impossibile caricare la foto profilo',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleResetPassword = async () => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(userProfile.email, {
        redirectTo: `${window.location.origin}/auth`,
      });

      if (error) throw error;

      toast({
        title: 'Email inviata',
        description: 'Controlla la tua email per reimpostare la password',
      });
    } catch (error) {
      console.error('Error resetting password:', error);
      toast({
        title: 'Errore',
        description: 'Impossibile inviare l\'email di reset',
        variant: 'destructive',
      });
    }
  };

  const passwordSchema = z.object({
    password: z
      .string()
      .min(8, "La password deve contenere almeno 8 caratteri")
      .regex(/[A-Z]/, "Deve contenere almeno una lettera maiuscola")
      .regex(/[a-z]/, "Deve contenere almeno una lettera minuscola")
      .regex(/[0-9]/, "Deve contenere almeno un numero")
      .regex(/[^A-Za-z0-9]/, "Deve contenere almeno un carattere speciale"),
    confirmPassword: z.string(),
  }).refine((data) => data.password === data.confirmPassword, {
    message: "Le password non corrispondono",
    path: ["confirmPassword"],
  });

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const result = passwordSchema.safeParse({ 
      password: newPassword, 
      confirmPassword 
    });

    if (!result.success) {
      const errors = result.error.errors.map((e) => e.message).join(", ");
      toast({
        title: "Errore di validazione",
        description: errors,
        variant: "destructive",
      });
      return;
    }

    setChangingPassword(true);
    
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      toast({
        title: "Password aggiornata",
        description: "La tua password è stata modificata con successo.",
      });
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      console.error('Error changing password:', error);
      toast({
        title: "Errore",
        description: "Impossibile aggiornare la password",
        variant: "destructive",
      });
    } finally {
      setChangingPassword(false);
    }
  };

  const getInitials = () => {
    const firstInitial = userProfile.first_name?.[0] || '';
    const lastInitial = userProfile.last_name?.[0] || '';
    return `${firstInitial}${lastInitial}`.toUpperCase() || '?';
  };

  return (
    <div className="page-container-sm">
      <div className="stack-lg">
        <div className="page-header">
          <h1 className="page-title">Il Mio Profilo</h1>
        </div>

        {/* Avatar Section */}
        <Card>
          <CardHeader>
            <CardTitle>Foto Profilo</CardTitle>
            <CardDescription>Carica una tua foto per personalizzare il profilo</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center gap-6">
            <div className="relative">
              <Avatar className="h-24 w-24">
                <AvatarImage src={userProfile.avatar_url} />
                <AvatarFallback className="text-2xl">{getInitials()}</AvatarFallback>
              </Avatar>
              <label
                htmlFor="avatar-upload"
                className="absolute bottom-0 right-0 p-2 bg-primary text-primary-foreground rounded-full cursor-pointer hover:bg-primary/90 transition-colors"
              >
                {uploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Camera className="h-4 w-4" />
                )}
              </label>
              <input
                id="avatar-upload"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarUpload}
                disabled={uploading}
              />
            </div>
            <div>
              <p className="text-sm font-medium">Carica una nuova foto</p>
              <p className="text-xs text-muted-foreground">
                JPG, PNG o GIF. Max 5MB.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Personal Info Section */}
        <Card>
          <CardHeader>
            <CardTitle>Informazioni Personali</CardTitle>
            <CardDescription>Aggiorna i tuoi dati personali</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="first_name">Nome</Label>
                  <Input
                    id="first_name"
                    value={userProfile.first_name}
                    onChange={(e) =>
                      setUserProfile({ ...userProfile, first_name: e.target.value })
                    }
                    placeholder="Il tuo nome"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="last_name">Cognome</Label>
                  <Input
                    id="last_name"
                    value={userProfile.last_name}
                    onChange={(e) =>
                      setUserProfile({ ...userProfile, last_name: e.target.value })
                    }
                    placeholder="Il tuo cognome"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={userProfile.email}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">
                  L'email non può essere modificata direttamente
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Titolo</Label>
                  <Input
                    id="title"
                    value={userProfile.title}
                    onChange={(e) =>
                      setUserProfile({ ...userProfile, title: e.target.value })
                    }
                    placeholder="Es. Operations Manager, CEO..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="area">Area</Label>
                  <select
                    id="area"
                    value={userProfile.area}
                    onChange={(e) =>
                      setUserProfile({ ...userProfile, area: e.target.value })
                    }
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="">Seleziona area</option>
                    <option value="tech">Tech</option>
                    <option value="marketing">Marketing</option>
                    <option value="branding">Branding</option>
                    <option value="sales">Sales</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="role">Ruolo</Label>
                <Input
                  id="role"
                  value={
                    userProfile.role === 'admin' 
                      ? 'Amministratore' 
                      : userProfile.role === 'editor' 
                      ? 'Editor' 
                      : userProfile.role === 'subscriber'
                      ? 'Utente'
                      : userProfile.role === 'account'
                      ? 'Account'
                      : userProfile.role === 'finance'
                      ? 'Finance'
                      : userProfile.role === 'team_leader'
                      ? 'Team Leader'
                      : userProfile.role === 'coordinator'
                      ? 'Coordinator'
                      : userProfile.role === 'member'
                      ? 'Member'
                      : ''
                  }
                  disabled
                  className="bg-muted"
                />
              </div>

              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salva Modifiche
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Security Section */}
        <Card>
          <CardHeader>
            <CardTitle>Cambia Password</CardTitle>
            <CardDescription>Modifica la tua password direttamente da qui</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">Nuova Password</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Inserisci la nuova password"
                  required
                />
                {newPassword && (
                  <PasswordStrengthIndicator password={newPassword} />
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Conferma Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Conferma la nuova password"
                  required
                />
              </div>
              <Button type="submit" disabled={changingPassword}>
                {changingPassword && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {changingPassword ? "Aggiornamento..." : "Aggiorna Password"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Reset Password via Email */}
        <Card>
          <CardHeader>
            <CardTitle>Reset Password via Email</CardTitle>
            <CardDescription>Ricevi un link per reimpostare la password via email</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Password dimenticata?</p>
                <p className="text-sm text-muted-foreground">
                  Ti invieremo un'email con le istruzioni per reimpostare la password
                </p>
              </div>
              <Button variant="outline" onClick={handleResetPassword}>
                Invia Email
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Google Account Link */}
        <Card>
          <CardHeader>
            <CardTitle>Account Google</CardTitle>
            <CardDescription>Collega il tuo account Google per accedere più velocemente</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-muted rounded-lg">
                  <svg className="h-6 w-6" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                </div>
                <div>
                  <p className="font-medium">
                    {googleLinked ? 'Account Google collegato' : 'Collega il tuo account Google'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {googleLinked 
                      ? 'Puoi accedere con Google oltre che con email e password' 
                      : 'Accedi più velocemente con il tuo account Google'}
                  </p>
                </div>
              </div>
              <Button 
                variant={googleLinked ? "destructive" : "outline"} 
                onClick={googleLinked ? handleUnlinkGoogle : handleLinkGoogle}
                disabled={linkingGoogle}
              >
                {linkingGoogle && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {googleLinked ? (
                  <>
                    <Unlink className="h-4 w-4 mr-2" />
                    Scollega
                  </>
                ) : (
                  <>
                    <Link2 className="h-4 w-4 mr-2" />
                    Collega
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Notification Preferences */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Preferenze Notifiche
            </CardTitle>
            <CardDescription>Configura come vuoi ricevere le notifiche</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Header row */}
              <div className="flex items-center justify-end gap-8 px-3 text-sm font-medium text-muted-foreground">
                <div className="flex items-center gap-1 w-20 justify-center">
                  <Bell className="h-4 w-4" />
                  <span>In-App</span>
                </div>
                <div className="flex items-center gap-1 w-20 justify-center">
                  <Mail className="h-4 w-4" />
                  <span>Email</span>
                </div>
              </div>
              
              <Separator />
              
              {/* Notification type rows */}
              {NOTIFICATION_TYPES.map((notificationType) => {
                const pref = notificationPreferences.find(
                  p => p.notification_type === notificationType.type
                );
                
                return (
                  <div 
                    key={notificationType.type}
                    className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50"
                  >
                    <div className="flex-1">
                      <p className="font-medium text-sm">{notificationType.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {notificationType.description}
                      </p>
                    </div>
                    <div className="flex items-center gap-8">
                      <div className="w-20 flex justify-center">
                        <Switch
                          checked={pref?.in_app_enabled ?? true}
                          onCheckedChange={(checked) => 
                            updateNotificationPreference(notificationType.type, 'in_app_enabled', checked)
                          }
                          disabled={savingPreferences}
                        />
                      </div>
                      <div className="w-20 flex justify-center">
                        <Switch
                          checked={pref?.email_enabled ?? true}
                          onCheckedChange={(checked) => 
                            updateNotificationPreference(notificationType.type, 'email_enabled', checked)
                          }
                          disabled={savingPreferences}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Profile;