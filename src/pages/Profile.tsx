import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Separator } from '@/components/ui/separator';

const Profile = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [userProfile, setUserProfile] = useState({
    first_name: '',
    last_name: '',
    email: '',
    avatar_url: '',
    role: '',
  });

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/auth');
        return;
      }

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('first_name, last_name, email, avatar_url')
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

      setUploading(true);
      const file = e.target.files[0];
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

  const getInitials = () => {
    const firstInitial = userProfile.first_name?.[0] || '';
    const lastInitial = userProfile.last_name?.[0] || '';
    return `${firstInitial}${lastInitial}`.toUpperCase() || '?';
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Il Mio Profilo</h1>
          <p className="text-muted-foreground">Gestisci le tue informazioni personali</p>
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
            <CardTitle>Sicurezza</CardTitle>
            <CardDescription>Gestisci la sicurezza del tuo account</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Password</p>
                <p className="text-sm text-muted-foreground">
                  Reimposta la tua password tramite email
                </p>
              </div>
              <Button variant="outline" onClick={handleResetPassword}>
                Reimposta Password
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Profile;