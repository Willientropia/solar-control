import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { fetchWithAuth, useAuthContext } from '@/contexts/AuthContext';
import { UserPlus, Loader2, AlertCircle, Shield, User, UserCog, Pencil } from 'lucide-react';

interface UserData {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
  isActive: boolean;
  emailVerified: boolean;
  createdAt: string;
  organization?: {
    id: string;
    name: string;
    slug: string;
  };
}

export default function UsuariosPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuthContext();

  // Create dialog state
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [role, setRole] = useState<'admin' | 'operador'>('operador');
  const [createError, setCreateError] = useState('');

  // Edit dialog state
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserData | null>(null);
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editRole, setEditRole] = useState<'admin' | 'operador'>('operador');
  const [editError, setEditError] = useState('');

  // Buscar membros da organização
  const { data: members, isLoading, refetch } = useQuery<UserData[]>({
    queryKey: ['/api/organizations', currentUser?.organization?.id, 'members'],
    queryFn: async () => {
      if (!currentUser?.organization?.id) {
        throw new Error('Organization not found');
      }

      const response = await fetchWithAuth(
        `/api/organizations/${currentUser.organization.id}/members`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch members');
      }

      const data = await response.json();

      // Transform data to include user info
      return data.map((member: any) => ({
        id: member.userId,
        email: member.user?.email || '',
        firstName: member.user?.firstName || null,
        lastName: member.user?.lastName || null,
        role: member.role,
        isActive: member.isActive,
        emailVerified: member.user?.emailVerified || false,
        createdAt: member.joinedAt,
        organization: currentUser.organization,
      }));
    },
    enabled: !!currentUser?.organization?.id,
  });

  // Refetch quando o currentUser mudar (fix para carregar usuarios após login)
  useEffect(() => {
    if (currentUser?.organization?.id) {
      refetch();
    }
  }, [currentUser?.organization?.id, refetch]);

  // Mutation para criar usuário
  const createUserMutation = useMutation({
    mutationFn: async (data: {
      email: string;
      password: string;
      firstName: string;
      lastName: string;
      role: string;
      organizationId: string;
    }) => {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create user');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['/api/organizations', currentUser?.organization?.id, 'members'],
      });

      toast({
        title: 'Usuário criado com sucesso!',
        description: 'O novo usuário já pode fazer login no sistema.',
      });

      // Reset form
      setEmail('');
      setPassword('');
      setFirstName('');
      setLastName('');
      setRole('operador');
      setCreateError('');
      setIsCreateDialogOpen(false);
    },
    onError: (error: Error) => {
      setCreateError(error.message);
    },
  });

  // Mutation para atualizar usuário
  const updateUserMutation = useMutation({
    mutationFn: async (data: {
      userId: string;
      role: string;
    }) => {
      if (!currentUser?.organization?.id) {
        throw new Error('Organization not found');
      }

      const response = await fetchWithAuth(
        `/api/organizations/${currentUser.organization.id}/members/${data.userId}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ role: data.role }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update user');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['/api/organizations', currentUser?.organization?.id, 'members'],
      });

      toast({
        title: 'Usuário atualizado com sucesso!',
        description: 'As alterações foram salvas.',
      });

      setEditingUser(null);
      setIsEditDialogOpen(false);
      setEditError('');
    },
    onError: (error: Error) => {
      setEditError(error.message);
    },
  });

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');

    if (!email || !password || !firstName) {
      setCreateError('Por favor, preencha todos os campos obrigatórios');
      return;
    }

    if (password.length < 8) {
      setCreateError('A senha deve ter no mínimo 8 caracteres');
      return;
    }

    if (!currentUser?.organization?.id) {
      setCreateError('Organização não encontrada');
      return;
    }

    createUserMutation.mutate({
      email,
      password,
      firstName,
      lastName,
      role,
      organizationId: currentUser.organization.id,
    });
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setEditError('');

    if (!editingUser) {
      setEditError('Usuário não selecionado');
      return;
    }

    updateUserMutation.mutate({
      userId: editingUser.id,
      role: editRole,
    });
  };

  const openEditDialog = (user: UserData) => {
    setEditingUser(user);
    setEditFirstName(user.firstName || '');
    setEditLastName(user.lastName || '');
    setEditRole(user.role === 'admin' || user.role === 'super_admin' ? 'admin' : 'operador');
    setEditError('');
    setIsEditDialogOpen(true);
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'super_admin':
        return <Shield className="h-4 w-4" />;
      case 'admin':
        return <UserCog className="h-4 w-4" />;
      default:
        return <User className="h-4 w-4" />;
    }
  };

  const getRoleBadgeVariant = (role: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (role) {
      case 'super_admin':
        return 'destructive';
      case 'admin':
        return 'default';
      default:
        return 'secondary';
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'super_admin':
        return 'Super Admin';
      case 'admin':
        return 'Administrador';
      case 'operador':
        return 'Operador';
      default:
        return role;
    }
  };

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Gerenciamento de Usuários"
        description="Cadastre e gerencie usuários da sua organização"
      />

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Usuários</CardTitle>
              <CardDescription>
                {members?.length || 0} usuário(s) cadastrado(s)
              </CardDescription>
            </div>

            {/* Dialog para criar usuário */}
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Novo Usuário
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <form onSubmit={handleCreateSubmit}>
                  <DialogHeader>
                    <DialogTitle>Cadastrar Novo Usuário</DialogTitle>
                    <DialogDescription>
                      Crie uma nova conta de usuário para sua organização
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4 py-4">
                    {createError && (
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{createError}</AlertDescription>
                      </Alert>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="email">
                        Email <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="usuario@exemplo.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="password">
                        Senha <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="password"
                        type="password"
                        placeholder="Mínimo 8 caracteres"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        minLength={8}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="firstName">
                          Nome <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id="firstName"
                          placeholder="Nome"
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="lastName">Sobrenome</Label>
                        <Input
                          id="lastName"
                          placeholder="Sobrenome"
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="role">Nível de Acesso</Label>
                      <Select
                        value={role}
                        onValueChange={(value: 'admin' | 'operador') => setRole(value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="operador">
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4" />
                              <span>Operador</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="admin">
                            <div className="flex items-center gap-2">
                              <UserCog className="h-4 w-4" />
                              <span>Administrador</span>
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Administradores têm acesso completo à organização
                      </p>
                    </div>
                  </div>

                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsCreateDialogOpen(false)}
                      disabled={createUserMutation.isPending}
                    >
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={createUserMutation.isPending}>
                      {createUserMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Criando...
                        </>
                      ) : (
                        'Criar Usuário'
                      )}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Carregando usuários...
            </div>
          ) : members && members.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Nível de Acesso</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data de Cadastro</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell className="font-medium">
                      {member.firstName} {member.lastName}
                    </TableCell>
                    <TableCell>{member.email}</TableCell>
                    <TableCell>
                      <Badge
                        variant={getRoleBadgeVariant(member.role)}
                        className="flex items-center gap-1 w-fit"
                      >
                        {getRoleIcon(member.role)}
                        {getRoleLabel(member.role)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {member.isActive ? (
                        <Badge variant="outline" className="text-green-600">
                          Ativo
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-gray-500">
                          Inativo
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {new Date(member.createdAt).toLocaleDateString('pt-BR')}
                    </TableCell>
                    <TableCell className="text-right">
                      {member.role !== 'super_admin' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditDialog(member)}
                        >
                          <Pencil className="h-4 w-4 mr-2" />
                          Editar
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum usuário cadastrado
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog para editar usuário */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <form onSubmit={handleEditSubmit}>
            <DialogHeader>
              <DialogTitle>Editar Usuário</DialogTitle>
              <DialogDescription>
                Altere o nível de acesso do usuário
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {editError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{editError}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  value={editingUser?.email || ''}
                  disabled
                  className="bg-muted"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nome</Label>
                  <Input
                    value={editFirstName}
                    disabled
                    className="bg-muted"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Sobrenome</Label>
                  <Input
                    value={editLastName}
                    disabled
                    className="bg-muted"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="editRole">Nível de Acesso</Label>
                <Select
                  value={editRole}
                  onValueChange={(value: 'admin' | 'operador') => setEditRole(value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="operador">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        <span>Operador</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="admin">
                      <div className="flex items-center gap-2">
                        <UserCog className="h-4 w-4" />
                        <span>Administrador</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Administradores têm acesso completo à organização
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditDialogOpen(false)}
                disabled={updateUserMutation.isPending}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={updateUserMutation.isPending}>
                {updateUserMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  'Salvar Alterações'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
