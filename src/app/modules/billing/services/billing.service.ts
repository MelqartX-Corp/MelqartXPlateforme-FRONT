import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  ServiceCatalog,
  CreateServiceRequest,
  UpdatePriceRequest,
  PriceVersion,
  Quote,
  CreateQuoteRequest,
  Contract,
  Invoice,
  Payment,
  BillingDashboard,
  ManufacturingParams,
  InstantQuoteRequest,
  InstantQuoteResponse,
  BillingAnalytics
} from '../models/billing.models';

@Injectable({ providedIn: 'root' })
export class BillingService {
  private http = inject(HttpClient);
  private base = environment.services.gateway + environment.apiVersion + '/billing';

  /** GET /billing/dashboard — indicateurs financiers globaux */
  getBillingDashboard(): Observable<BillingDashboard> {
    return this.http.get<BillingDashboard>(`${this.base}/dashboard`);
  }

  // ─── Devis instantané (Prototype & Production) ───

  /**
   * Chiffre sans rien enregistrer. C'est l'appel du configurateur : le client
   * fait varier la quantité et voit le prix bouger, sans créer dix devis.
   */
  simulateInstantQuote(req: InstantQuoteRequest): Observable<InstantQuoteResponse> {
    return this.http.post<InstantQuoteResponse>(this.base + '/quotes/instant/simulate', req);
  }

  /** Crée le devis pour de bon. Il part directement au statut SENT. */
  createInstantQuote(req: InstantQuoteRequest): Observable<InstantQuoteResponse> {
    return this.http.post<InstantQuoteResponse>(this.base + '/quotes/instant', req);
  }

  // ─── Réglages d'atelier (admin) ───

  getManufacturingParams(): Observable<ManufacturingParams> {
    return this.http.get<ManufacturingParams>(this.base + '/manufacturing-params');
  }

  updateManufacturingParams(params: ManufacturingParams): Observable<ManufacturingParams> {
    return this.http.put<ManufacturingParams>(this.base + '/manufacturing-params', params);
  }

  // ─── Service Catalog & Pricing ───

  getServices(): Observable<ServiceCatalog[]> {
    return this.http.get<ServiceCatalog[]>(this.base + '/services');
  }

  getServiceById(id: string): Observable<ServiceCatalog> {
    return this.http.get<ServiceCatalog>(this.base + '/services/' + id);
  }

  createService(req: CreateServiceRequest): Observable<ServiceCatalog> {
    return this.http.post<ServiceCatalog>(this.base + '/services', req);
  }

  updateServicePrice(serviceId: string, req: UpdatePriceRequest): Observable<PriceVersion> {
    return this.http.post<PriceVersion>(this.base + '/services/' + serviceId + '/prices', req);
  }

  // ─── Quotes ───

  getQuotes(): Observable<Quote[]> {
    return this.http.get<Quote[]>(this.base + '/quotes');
  }

  getQuote(id: string): Observable<Quote> {
    return this.http.get<Quote>(this.base + '/quotes/' + id);
  }

  getQuotesByProject(projectId: string): Observable<Quote[]> {
    return this.http.get<Quote[]>(this.base + '/quotes/project/' + projectId);
  }

  createQuote(req: CreateQuoteRequest): Observable<Quote> {
    return this.http.post<Quote>(this.base + '/quotes', req);
  }

  sendQuote(quoteId: string): Observable<Quote> {
    return this.http.put<Quote>(this.base + '/quotes/' + quoteId + '/send', {});
  }

  acceptQuote(quoteId: string): Observable<Quote> {
    return this.http.put<Quote>(this.base + '/quotes/' + quoteId + '/accept', {});
  }

  rejectQuote(quoteId: string): Observable<Quote> {
    return this.http.put<Quote>(this.base + '/quotes/' + quoteId + '/reject', {});
  }

  /**
   * Le devis en PDF. Contrairement à la facture, il se télécharge sans
   * condition de règlement : c'est le document qui sert à décider.
   */
  downloadQuotePdf(quoteId: string): Observable<Blob> {
    return this.http.get(this.base + '/quotes/' + quoteId + '/pdf', { responseType: 'blob' });
  }

  // ─── Contracts ───

  getContract(id: string): Observable<Contract> {
    return this.http.get<Contract>(this.base + '/contracts/' + id);
  }

  getContractByProject(projectId: string): Observable<Contract> {
    return this.http.get<Contract>(this.base + '/contracts/project/' + projectId);
  }

  downloadContractPdf(contractId: string): Observable<Blob> {
    return this.http.get(this.base + '/contracts/' + contractId + '/pdf', { responseType: 'blob' });
  }

  downloadContractPdfByQuote(quoteId: string): Observable<Blob> {
    return this.http.get(this.base + '/contracts/quote/' + quoteId + '/pdf', { responseType: 'blob' });
  }

  uploadSignedContract(contractId: string, file: File): Observable<Contract> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<Contract>(this.base + '/contracts/' + contractId + '/upload-signed', formData);
  }

  uploadSignedContractByQuote(quoteId: string, file: File): Observable<Contract> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<Contract>(this.base + '/contracts/quote/' + quoteId + '/upload-signed', formData);
  }

  downloadSignedContract(contractId: string): Observable<Blob> {
    return this.http.get(this.base + '/contracts/' + contractId + '/download-signed', { responseType: 'blob' });
  }

  downloadSignedContractByQuote(quoteId: string): Observable<Blob> {
    return this.http.get(this.base + '/contracts/quote/' + quoteId + '/download-signed', { responseType: 'blob' });
  }

  // ─── Invoices ───

  getInvoices(): Observable<Invoice[]> {
    return this.http.get<Invoice[]>(this.base + '/invoices');
  }

  getInvoice(id: string): Observable<Invoice> {
    return this.http.get<Invoice>(this.base + '/invoices/' + id);
  }

  getInvoicesByProject(projectId: string): Observable<Invoice[]> {
    return this.http.get<Invoice[]>(this.base + '/invoices/project/' + projectId);
  }

  downloadInvoicePdf(invoiceId: string): Observable<Blob> {
    return this.http.get(this.base + '/invoices/' + invoiceId + '/pdf', { responseType: 'blob' });
  }

  issueBalanceInvoice(contractId: string, projectName?: string): Observable<Invoice> {
    let params = new HttpParams();
    if (projectName) params = params.set('projectName', projectName);
    return this.http.put<Invoice>(this.base + '/invoices/' + contractId + '/issue-tranche2', {}, { params });
  }

  // ─── Payments ───

  getPaymentsByProject(projectId: string): Observable<Payment[]> {
    return this.http.get<Payment[]>(this.base + '/payments/project/' + projectId);
  }

  /**
   * Encaisse une facture. Seul moyen de règlement de la plateforme : le
   * montant est arrêté par le serveur sur la facture, jamais transmis ici.
   */
  payInvoice(invoiceId: string): Observable<Payment> {
    return this.http.post<Payment>(this.base + '/payments/simulate-success', { invoiceId });
  }

  // ─── Dashboard KPIs ───

  getGlobalDashboard(): Observable<BillingDashboard> {
    return this.http.get<BillingDashboard>(this.base + '/dashboard');
  }

  getProjectDashboard(projectId: string): Observable<BillingDashboard> {
    return this.http.get<BillingDashboard>(this.base + '/dashboard/project/' + projectId);
  }

  /**
   * GET /billing/dashboard/analytics — séries et répartitions.
   *
   * Un seul appel pour tout le domaine facturation : reconstituer ces courbes
   * côté navigateur obligerait à rapatrier l'intégralité des devis, factures
   * et commandes, dont le volume grandit à chaque mois d'exploitation.
   *
   * Réservé à l'administrateur et au chef de projet — la réponse détaille le
   * chiffre d'affaires par client.
   */
  getAnalytics(): Observable<BillingAnalytics> {
    return this.http.get<BillingAnalytics>(this.base + '/dashboard/analytics');
  }
}
