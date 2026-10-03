import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ComponentService } from '../../services/component.service';
import { Component as StockComponent, ComponentRequest, MountType, ComponentCategory, ComponentSubCategory, CLASSIFICATION } from '../../models/stock.models';
import { Page } from '../../../../shared/models/shared.models';

@Component({
  selector: 'app-component-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './component-list.component.html',
})
export class ComponentListComponent implements OnInit {
  private svc = inject(ComponentService);
  private router = inject(Router);

  loading = true;
  error = '';
  components: StockComponent[] = [];
  totalElements = 0;
  currentPage = 0;
  pageSize = 20;

  // Filters
  filterManufacturer = '';
  filterMpn = '';
  filterPackage = '';
  filterMount: MountType | '' = '';
  filterCategory: ComponentCategory | '' = '';
  filterSubCategory: ComponentSubCategory | '' = '';

  // Classification metadata
  classification = CLASSIFICATION;

  // Modal
  showModal = false;
  isEditing = false;
  saving = false;
  saveError = '';
  editId = '';
  form: ComponentRequest = { manufacturer: '', mpn: '' };

  // Image
  selectedFile: File | null = null;
  imagePreview: string | null = null;
  uploadingImage = false;
  existingImageUrl: string | null = null; // Track existing Cloudinary image

  // Delete confirm
  showDeleteModal = false;
  deletingId = '';
  deleting = false;

  ngOnInit() { this.load(); }

  load() {
    this.loading = true;
    const hasFilter = this.filterManufacturer || this.filterMpn || this.filterPackage || this.filterMount || this.filterCategory || this.filterSubCategory;
    const obs = hasFilter
      ? this.svc.search({
          manufacturer: this.filterManufacturer || undefined,
          mpn: this.filterMpn || undefined,
          packageType: this.filterPackage || undefined,
          mountType: this.filterMount || undefined,
          category: this.filterCategory || undefined,
          subCategory: this.filterSubCategory || undefined,
          page: this.currentPage,
          size: this.pageSize
        })
      : this.svc.getComponents(this.currentPage, this.pageSize);
    obs.subscribe({
      next: (page) => { this.components = page.content; this.totalElements = page.totalElements; this.loading = false; },
      error: () => { this.error = 'Erreur de chargement'; this.loading = false; }
    });
  }

  search() { this.currentPage = 0; this.load(); }
  
  clearFilters() {
    this.filterManufacturer = '';
    this.filterMpn = '';
    this.filterPackage = '';
    this.filterMount = '';
    this.filterCategory = '';
    this.filterSubCategory = '';
    this.currentPage = 0;
    this.load();
  }
  
  get hasActiveFilter(): boolean {
    return !!(this.filterManufacturer || this.filterMpn || this.filterPackage || this.filterMount || this.filterCategory || this.filterSubCategory);
  }
  
  prevPage() { if (this.currentPage > 0) { this.currentPage--; this.load(); } }
  nextPage() { if ((this.currentPage + 1) * this.pageSize < this.totalElements) { this.currentPage++; this.load(); } }

  get categoryKeys(): ComponentCategory[] {
    return Object.keys(this.classification) as ComponentCategory[];
  }

  getSubCategoriesFor(cat: ComponentCategory | undefined): { key: string, label: string }[] {
    if (!cat || !this.classification[cat]) return [];
    const subs = this.classification[cat].subCategories;
    return Object.keys(subs).map(k => ({ key: k, label: subs[k as ComponentSubCategory]! }));
  }

  onCategoryChange() {
    this.form.subCategory = undefined;
  }

  onFilterCategoryChange() {
    this.filterSubCategory = '';
    this.search();
  }

  openCreate() {
    this.isEditing = false; this.editId = ''; this.saveError = '';
    this.form = { manufacturer: '', mpn: '', description: '', packageType: '', mountType: undefined, mslLevel: undefined, seuilMinReels: undefined, category: undefined, subCategory: undefined };
    this.selectedFile = null; this.imagePreview = null; this.existingImageUrl = null;
    this.showModal = true;
  }

  openEdit(c: StockComponent) {
    this.isEditing = true; this.editId = c.id; this.saveError = '';
    this.form = {
      manufacturer: c.manufacturer, mpn: c.mpn, description: c.description,
      packageType: c.packageType, mountType: c.mountType, mslLevel: c.mslLevel,
      seuilMinReels: c.seuilMinReels, category: c.category, subCategory: c.subCategory
    };
    this.selectedFile = null;
    this.imagePreview = c.imageUrl || null;
    this.existingImageUrl = c.imageUrl || null;
    this.showModal = true;
  }

  closeModal() { this.showModal = false; }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.selectedFile = input.files[0];
      const reader = new FileReader();
      reader.onload = () => { this.imagePreview = reader.result as string; };
      reader.readAsDataURL(this.selectedFile);
    }
  }

  clearImage() {
    this.selectedFile = null;
    this.imagePreview = null;
  }

  save() {
    this.saving = true; this.saveError = '';

    // Clean form: convert empty seuilMinReels to null
    const payload: ComponentRequest = {
      ...this.form,
      seuilMinReels: this.form.seuilMinReels ? Number(this.form.seuilMinReels) : undefined
    };

    const obs = this.isEditing ? this.svc.update(this.editId, payload) : this.svc.create(payload);
    obs.subscribe({
      next: (comp) => {
        const compId = this.isEditing ? this.editId : comp.id;

        // Case 1: New image selected → upload
        if (this.selectedFile) {
          this.svc.uploadImage(compId, this.selectedFile).subscribe({
            next: () => { this.saving = false; this.showModal = false; this.load(); },
            error: (e) => {
              this.saving = false; this.showModal = false; this.load();
              console.error('Image upload failed:', e);
            }
          });
        }
        // Case 2: Image was removed (had one, now cleared)
        else if (this.existingImageUrl && !this.imagePreview) {
          this.svc.deleteImage(compId).subscribe({
            next: () => { this.saving = false; this.showModal = false; this.load(); },
            error: () => { this.saving = false; this.showModal = false; this.load(); }
          });
        }
        // Case 3: No change
        else {
          this.saving = false; this.showModal = false; this.load();
        }
      },
      error: (e) => { this.saving = false; this.saveError = e.error?.message || 'Erreur de sauvegarde'; }
    });
  }

  removeImage(c: StockComponent) {
    this.svc.deleteImage(c.id).subscribe({ next: () => this.load() });
  }

  navigateToDetail(c: StockComponent) { this.router.navigate(['/stock/components', c.id]); }

  confirmDelete(id: string) { this.deletingId = id; this.showDeleteModal = true; }
  cancelDelete() { this.showDeleteModal = false; this.deletingId = ''; }

  doDelete() {
    this.deleting = true;
    this.svc.delete(this.deletingId).subscribe({
      next: () => { this.deleting = false; this.showDeleteModal = false; this.load(); },
      error: () => { this.deleting = false; this.showDeleteModal = false; }
    });
  }

  get totalPages(): number { return Math.ceil(this.totalElements / this.pageSize); }

  mslBg(level: number | undefined): string {
    if (!level) return 'hsl(var(--secondary))';
    if (level <= 1) return 'hsl(var(--success)/0.12)';
    if (level <= 3) return 'hsl(var(--warning)/0.12)';
    return 'hsl(var(--destructive)/0.12)';
  }

  mslColor(level: number | undefined): string {
    if (!level) return 'hsl(var(--muted-foreground))';
    if (level <= 1) return 'hsl(var(--success))';
    if (level <= 3) return 'hsl(var(--warning))';
    return 'hsl(var(--destructive))';
  }
}
