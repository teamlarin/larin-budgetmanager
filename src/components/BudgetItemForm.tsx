import { useState, useEffect } from 'react';
import { BudgetItem } from '@/types/budget';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Package } from 'lucide-react';

interface BudgetTemplate {
  id: string;
  name: string;
  description: string | null;
  template_data: any;
}

interface Level {
  id: string;
  name: string;
  hourly_rate: number;
  area: string;
}

interface ActivityCategory {
  id: string;
  name: string;
}

interface Product {
  id: string;
  code: string;
  name: string;
  description: string | null;
  category: string;
  net_price: number;
  gross_price: number;
}

interface BudgetItemFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (item: Omit<BudgetItem, 'id'> | BudgetItem) => void;
  initialData?: BudgetItem;
  isEditing?: boolean;
}

export const BudgetItemForm = ({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  isEditing = false
}: BudgetItemFormProps) => {
  const { toast } = useToast();
  const [budgetTemplates, setBudgetTemplates] = useState<BudgetTemplate[]>([]);
  const [levels, setLevels] = useState<Level[]>([]);
  const [categories, setCategories] = useState<ActivityCategory[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<BudgetTemplate | null>(null);
  const [selectedTemplateActivity, setSelectedTemplateActivity] = useState<any | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState({
    category: '',
    activityName: '',
    assigneeId: '',
    assigneeName: '',
    hourlyRate: 0,
    hoursWorked: 0,
    isCustomActivity: false,
    isProduct: false,
    productId: '',
  });

  useEffect(() => {
    if (isOpen) {
      fetchData();
    }
  }, [isOpen]);

  useEffect(() => {
    if (initialData) {
      setFormData({
        category: initialData.category,
        activityName: initialData.activityName,
        assigneeId: initialData.assigneeId,
        assigneeName: initialData.assigneeName,
        hourlyRate: initialData.hourlyRate,
        hoursWorked: initialData.hoursWorked,
        isCustomActivity: initialData.isCustomActivity || false,
        isProduct: initialData.isProduct || false,
        productId: initialData.productId || '',
      });
    } else {
      setFormData({
        category: '',
        activityName: '',
        assigneeId: '',
        assigneeName: '',
        hourlyRate: 0,
        hoursWorked: 0,
        isCustomActivity: false,
        isProduct: false,
        productId: '',
      });
      setSelectedTemplate(null);
      setSelectedTemplateActivity(null);
      setSelectedProduct(null);
    }
  }, [initialData, isOpen]);

  const fetchData = async () => {
    try {
      // Fetch budget templates
      const { data: templatesData, error: templatesError } = await supabase
        .from('budget_templates')
        .select('*')
        .order('name');

      if (templatesError) throw templatesError;
      setBudgetTemplates((templatesData || []).map(t => ({
        ...t,
        template_data: Array.isArray(t.template_data) ? t.template_data : []
      })));

      // Fetch levels
      const { data: levelsData, error: levelsError } = await supabase
        .from('levels')
        .select('*')
        .order('name');

      if (levelsError) throw levelsError;
      setLevels(levelsData || []);

      // Fetch categories
      const { data: categoriesData, error: categoriesError } = await supabase
        .from('activity_categories')
        .select('*')
        .order('name');

      if (categoriesError) throw categoriesError;
      setCategories(categoriesData || []);

      // Fetch products
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('*')
        .order('name');

      if (productsError) throw productsError;
      setProducts(productsData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: 'Errore',
        description: 'Impossibile caricare i dati.',
        variant: 'destructive',
      });
    }
  };

  const handleLevelChange = (levelId: string) => {
    const level = levels.find(l => l.id === levelId);
    if (level) {
      setFormData(prev => ({
        ...prev,
        assigneeId: level.id,
        assigneeName: level.name,
        hourlyRate: level.hourly_rate,
      }));
    }
  };

  const handleTemplateActivitySelect = (activity: any) => {
    setSelectedTemplateActivity(activity);
    const level = levels.find(l => l.id === activity.levelId);
    setFormData(prev => ({
      ...prev,
      category: activity.category,
      activityName: activity.activityName,
      hoursWorked: activity.hours,
      assigneeId: activity.levelId,
      assigneeName: activity.levelName,
      hourlyRate: level?.hourly_rate || 0,
      isCustomActivity: false,
    }));
  };

  const handleCustomActivity = () => {
    setSelectedTemplateActivity(null);
    setSelectedProduct(null);
    setFormData(prev => ({
      ...prev,
      isCustomActivity: true,
      isProduct: false,
    }));
  };

  const handleProductSelect = (product: Product) => {
    setSelectedProduct(product);
    setSelectedTemplateActivity(null);
    setFormData(prev => ({
      ...prev,
      category: product.category,
      activityName: product.name,
      hourlyRate: product.gross_price,
      hoursWorked: 1,
      assigneeId: '',
      assigneeName: '',
      isCustomActivity: false,
      isProduct: true,
      productId: product.id,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const totalCost = formData.hourlyRate * formData.hoursWorked;
    
    if (isEditing && initialData) {
      onSubmit({
        ...initialData,
        ...formData,
        totalCost,
      });
    } else {
      onSubmit({
        ...formData,
        totalCost,
      });
    }
    onClose();
  };

  const isValid = formData.activityName.trim() && 
    (formData.isProduct || (formData.assigneeId && formData.hourlyRate > 0));

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl bg-gradient-card shadow-medium max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            {isEditing 
              ? (formData.isProduct ? 'Modifica Prodotto' : 'Modifica Attività')
              : 'Nuovo Elemento Budget'
            }
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {!isEditing && (
            <Tabs defaultValue="predefined" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="predefined">Attività Predefinite</TabsTrigger>
                <TabsTrigger value="custom" onClick={handleCustomActivity}>Attività Personalizzata</TabsTrigger>
                <TabsTrigger value="product">Prodotti</TabsTrigger>
              </TabsList>
              
              <TabsContent value="predefined" className="space-y-4">
                <div className="space-y-2">
                  <Label>Modello Budget</Label>
                  <Select
                    value={selectedTemplate?.id || ''}
                    onValueChange={(value) => {
                      const template = budgetTemplates.find(t => t.id === value);
                      setSelectedTemplate(template || null);
                      setSelectedTemplateActivity(null);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona un modello" />
                    </SelectTrigger>
                    <SelectContent>
                      {budgetTemplates.map(template => {
                        const totalHours = template.template_data?.reduce((sum: number, activity: any) => sum + (activity.hours || 0), 0) || 0;
                        const totalCost = template.template_data?.reduce((sum: number, activity: any) => sum + ((activity.hours || 0) * (activity.hourlyRate || 0)), 0) || 0;
                        
                        return (
                          <SelectItem key={template.id} value={template.id}>
                            <div className="flex flex-col">
                              <span>{template.name}</span>
                              <span className="text-xs text-muted-foreground">
                                {totalHours}h • €{totalCost.toFixed(2)}
                              </span>
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                {selectedTemplate && selectedTemplate.template_data && selectedTemplate.template_data.length > 0 && (
                  <div className="space-y-2">
                    <Label>Attività</Label>
                    <Select
                      value={selectedTemplateActivity ? `${selectedTemplateActivity.category}-${selectedTemplateActivity.activityName}` : ''}
                      onValueChange={(value) => {
                        const activity = selectedTemplate.template_data.find(
                          (a: any) => `${a.category}-${a.activityName}` === value
                        );
                        if (activity) handleTemplateActivitySelect(activity);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleziona un'attività" />
                      </SelectTrigger>
                      <SelectContent>
                        {selectedTemplate.template_data.map((activity: any, index: number) => (
                          <SelectItem key={index} value={`${activity.category}-${activity.activityName}`}>
                            <div className="flex flex-col">
                              <span>{activity.activityName}</span>
                              <span className="text-sm text-muted-foreground">
                                {activity.category} • {activity.hours}h • {activity.levelName}
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {selectedTemplateActivity && (
                  <div className="bg-muted/50 rounded-lg p-4 border">
                    <h4 className="font-medium mb-2">{selectedTemplateActivity.activityName}</h4>
                    <div className="flex gap-4 text-sm">
                      <span><strong>Categoria:</strong> {selectedTemplateActivity.category}</span>
                      <span><strong>Ore:</strong> {selectedTemplateActivity.hours}</span>
                      <span><strong>Figura:</strong> {selectedTemplateActivity.levelName}</span>
                    </div>
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="custom" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="activityName">Nome Attività *</Label>
                  <Input
                    id="activityName"
                    value={formData.activityName}
                    onChange={(e) => setFormData(prev => ({ ...prev, activityName: e.target.value }))}
                    placeholder="Inserisci il nome dell'attività..."
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category">Categoria *</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(value: string) => setFormData(prev => ({ ...prev, category: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona una categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map(category => (
                        <SelectItem key={category.id} value={category.name}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Figura *</Label>
                  <Select
                    value={formData.assigneeId}
                    onValueChange={handleLevelChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona la figura" />
                    </SelectTrigger>
                    <SelectContent>
                      {levels.map(level => (
                        <SelectItem key={level.id} value={level.id}>
                          <div className="flex flex-col">
                            <span>{level.name}</span>
                            <span className="text-sm text-muted-foreground">
                              {level.area} • €{level.hourly_rate}/h
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="hoursWorked">Ore *</Label>
                  <Input
                    id="hoursWorked"
                    type="number"
                    min="0"
                    step="0.5"
                    value={formData.hoursWorked || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, hoursWorked: parseFloat(e.target.value) || 0 }))}
                    placeholder="0"
                  />
                </div>
              </TabsContent>
              
              <TabsContent value="product" className="space-y-4">
                <div className="space-y-2">
                  <Label>Seleziona Prodotto</Label>
                  <Select
                    value={selectedProduct?.id || ''}
                    onValueChange={(value) => {
                      const product = products.find(p => p.id === value);
                      if (product) handleProductSelect(product);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona un prodotto" />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map(product => (
                        <SelectItem key={product.id} value={product.id}>
                          <div className="flex flex-col">
                            <span className="font-medium">{product.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {product.code} • {product.category} • €{product.gross_price.toFixed(2)}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedProduct && (
                  <div className="bg-muted/50 rounded-lg p-4 border">
                    <div className="flex items-start gap-3">
                      <Package className="h-5 w-5 text-muted-foreground mt-1" />
                      <div className="flex-1">
                        <h4 className="font-medium mb-1">{selectedProduct.name}</h4>
                        <p className="text-sm text-muted-foreground mb-2">{selectedProduct.description}</p>
                        <div className="flex gap-4 text-sm">
                          <span><strong>Codice:</strong> {selectedProduct.code}</span>
                          <span><strong>Categoria:</strong> {selectedProduct.category}</span>
                          <span><strong>Prezzo:</strong> €{selectedProduct.gross_price.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="mt-4 space-y-2">
                      <Label htmlFor="quantity">Quantità *</Label>
                      <Input
                        id="quantity"
                        type="number"
                        min="1"
                        step="1"
                        value={formData.hoursWorked || 1}
                        onChange={(e) => setFormData(prev => ({ ...prev, hoursWorked: parseInt(e.target.value) || 1 }))}
                        placeholder="1"
                      />
                    </div>

                    <div className="bg-background rounded-lg p-3 border mt-4">
                      <div className="flex justify-between items-center">
                        <span className="font-medium text-foreground">Costo Totale:</span>
                        <span className="text-xl font-bold text-primary">
                          €{(formData.hourlyRate * formData.hoursWorked).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}

          {(isEditing || formData.isCustomActivity || selectedTemplateActivity || selectedProduct) && (
            <>
              {!formData.isCustomActivity && !isEditing && !formData.isProduct && (
                <div className="bg-muted/50 rounded-lg p-4 border">
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-foreground">Costo Totale Previsto:</span>
                    <span className="text-xl font-bold text-primary">
                      €{(formData.hourlyRate * formData.hoursWorked).toFixed(2)}
                    </span>
                  </div>
                </div>
              )}

              {isEditing && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="activityName">Nome Attività</Label>
                    <Input
                      id="activityName"
                      value={formData.activityName}
                      onChange={(e) => setFormData(prev => ({ ...prev, activityName: e.target.value }))}
                      placeholder="Inserisci il nome dell'attività..."
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="category">Categoria</Label>
                    <Select
                      value={formData.category}
                      onValueChange={(value: string) => setFormData(prev => ({ ...prev, category: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleziona una categoria" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map(category => (
                          <SelectItem key={category.id} value={category.name}>
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Figura</Label>
                    <Select
                      value={formData.assigneeId}
                      onValueChange={handleLevelChange}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleziona la figura" />
                      </SelectTrigger>
                      <SelectContent>
                        {levels.map(level => (
                          <SelectItem key={level.id} value={level.id}>
                            <div className="flex flex-col">
                              <span>{level.name}</span>
                              <span className="text-sm text-muted-foreground">
                                {level.area} • €{level.hourly_rate}/h
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="hoursWorked">Ore</Label>
                    <Input
                      id="hoursWorked"
                      type="number"
                      min="0"
                      step="0.5"
                      value={formData.hoursWorked || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, hoursWorked: parseFloat(e.target.value) || 0 }))}
                      placeholder="0"
                    />
                  </div>

                  <div className="bg-muted/50 rounded-lg p-4 border">
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-foreground">Costo Totale Previsto:</span>
                      <span className="text-xl font-bold text-primary">
                        €{(formData.hourlyRate * formData.hoursWorked).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button type="button" variant="outline" onClick={onClose}>
                  Annulla
                </Button>
                <Button
                  type="submit"
                  disabled={!isValid}
                  className="bg-gradient-primary"
                >
                  {isEditing ? 'Aggiorna' : 'Aggiungi'}
                </Button>
              </div>
            </>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
};