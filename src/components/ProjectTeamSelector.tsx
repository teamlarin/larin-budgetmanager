import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { X, Edit2, Check } from 'lucide-react';
import { toast } from 'sonner';

interface User {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
}

interface ProjectTeamSelectorProps {
  projectId: string;
  onUpdate?: () => void;
}

export const ProjectTeamSelector = ({ projectId, onUpdate }: ProjectTeamSelectorProps) => {
  const [users, setUsers] = useState<User[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<User[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [tempSelection, setTempSelection] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchUsers();
    fetchProjectMembers();
  }, [projectId]);

  const fetchUsers = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, email')
      .eq('approved', true)
      .order('first_name');

    if (error) {
      console.error('Error fetching users:', error);
      return;
    }

    setUsers(data || []);
  };

  const fetchProjectMembers = async () => {
    const { data, error } = await supabase
      .from('project_members')
      .select('user_id')
      .eq('project_id', projectId);

    if (error) {
      console.error('Error fetching project members:', error);
      return;
    }

    const memberIds = data?.map(m => m.user_id) || [];
    
    // Fetch full user details for members
    const { data: membersData } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, email')
      .in('id', memberIds);

    setSelectedMembers(membersData || []);
    setTempSelection(memberIds);
  };

  const startEditing = () => {
    setIsEditing(true);
    setTempSelection(selectedMembers.map(m => m.id));
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setTempSelection(selectedMembers.map(m => m.id));
  };

  const saveMembers = async () => {
    setLoading(true);
    try {
      // Get current members
      const currentMemberIds = selectedMembers.map(m => m.id);
      
      // Determine members to add and remove
      const toAdd = tempSelection.filter(id => !currentMemberIds.includes(id));
      const toRemove = currentMemberIds.filter(id => !tempSelection.includes(id));

      // Remove members
      if (toRemove.length > 0) {
        const { error: deleteError } = await supabase
          .from('project_members')
          .delete()
          .eq('project_id', projectId)
          .in('user_id', toRemove);

        if (deleteError) throw deleteError;
      }

      // Add new members
      if (toAdd.length > 0) {
        const { error: insertError } = await supabase
          .from('project_members')
          .insert(toAdd.map(userId => ({
            project_id: projectId,
            user_id: userId
          })));

        if (insertError) throw insertError;
      }

      toast.success('Team aggiornato con successo');
      await fetchProjectMembers();
      setIsEditing(false);
      onUpdate?.();
    } catch (error) {
      console.error('Error updating team members:', error);
      toast.error('Errore durante l\'aggiornamento del team');
    } finally {
      setLoading(false);
    }
  };

  const toggleMember = (userId: string) => {
    setTempSelection(prev => 
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const removeMember = async (userId: string) => {
    try {
      const { error } = await supabase
        .from('project_members')
        .delete()
        .eq('project_id', projectId)
        .eq('user_id', userId);

      if (error) throw error;

      toast.success('Membro rimosso dal team');
      await fetchProjectMembers();
      onUpdate?.();
    } catch (error) {
      console.error('Error removing member:', error);
      toast.error('Errore durante la rimozione del membro');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm text-muted-foreground">Team di Progetto</p>
        {!isEditing && (
          <Button variant="ghost" size="sm" onClick={startEditing}>
            <Edit2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      {isEditing ? (
        <Card className="p-4 space-y-4">
          <ScrollArea className="h-[300px] pr-4">
            <div className="space-y-2">
              {users.map((user) => (
                <div 
                  key={user.id} 
                  className="flex items-center space-x-3 p-2 rounded hover:bg-muted/50"
                >
                  <Checkbox
                    id={`user-${user.id}`}
                    checked={tempSelection.includes(user.id)}
                    onCheckedChange={() => toggleMember(user.id)}
                  />
                  <label
                    htmlFor={`user-${user.id}`}
                    className="flex-1 cursor-pointer text-sm"
                  >
                    <div className="font-medium">
                      {user.first_name} {user.last_name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {user.email}
                    </div>
                  </label>
                </div>
              ))}
            </div>
          </ScrollArea>
          
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={cancelEditing} disabled={loading}>
              Annulla
            </Button>
            <Button size="sm" onClick={saveMembers} disabled={loading}>
              <Check className="h-4 w-4 mr-2" />
              Salva
            </Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-2">
          {selectedMembers.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">Nessun membro del team</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {selectedMembers.map((member) => (
                <Badge key={member.id} variant="secondary" className="pr-1">
                  <span className="mr-2">
                    {member.first_name} {member.last_name}
                  </span>
                  <button
                    onClick={() => removeMember(member.id)}
                    className="hover:bg-destructive/20 rounded p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
