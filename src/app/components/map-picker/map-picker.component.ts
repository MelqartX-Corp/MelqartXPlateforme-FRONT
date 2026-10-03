/// <reference types="@types/google.maps" />
import {
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
  AfterViewInit,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ThemeService } from '../../services';

export interface MapLocation {
  address: string;
  lat: number;
  lng: number;
}

@Component({
  selector: 'app-map-picker',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './map-picker.component.html',
  styleUrls: ['./map-picker.component.scss'],
})
export class MapPickerComponent implements OnInit, AfterViewInit, OnDestroy {
  @Input() initialAddress = '';
  @Input() googleMapsKey = '';
  @Output() locationSelected = new EventEmitter<MapLocation>();
  @Output() closed = new EventEmitter<void>();

  private themeService = inject(ThemeService);
  private map: google.maps.Map | null = null;
  private marker: google.maps.Marker | null = null;
  private geocoder: google.maps.Geocoder | null = null;
  private autocompleteEl: any = null;

  selectedAddress = '';
  selectedLat: number | null = null;
  selectedLng: number | null = null;
  mapLoaded = false;
  scriptError = false;
  is3DMode = false;

  /** Dark mode styles for Google Maps */
  private readonly darkMapStyles: google.maps.MapTypeStyle[] = [
    { elementType: 'geometry', stylers: [{ color: '#1d2c4d' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#8ec3b9' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#1a3646' }] },
    { featureType: 'administrative.country', elementType: 'geometry.stroke', stylers: [{ color: '#4b6878' }] },
    { featureType: 'administrative.province', elementType: 'geometry.stroke', stylers: [{ color: '#4b6878' }] },
    { featureType: 'water', elementType: 'geometry.fill', stylers: [{ color: '#0e1626' }] },
    { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#4e6d70' }] },
    { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#304a7d' }] },
    { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#255763' }] },
    { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#2c6675' }] },
    { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#255763' }] },
    { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#283d6a' }] },
    { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#6f9ba5' }] },
    { featureType: 'poi.park', elementType: 'geometry.fill', stylers: [{ color: '#023e58' }] },
    { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#2f3948' }] },
    { featureType: 'transit.station', elementType: 'labels.text.fill', stylers: [{ color: '#d59563' }] },
  ];

  ngOnInit(): void {
    this.loadGoogleMapsScript();
  }

  ngAfterViewInit(): void {}

  /** Toggle between 2D (roadmap) and Satellite mode */
  toggle3DMode(enable: boolean): void {
    if (this.is3DMode === enable || !this.map) return;
    this.is3DMode = enable;

    if (this.is3DMode) {
      this.map.setMapTypeId('satellite');
      this.map.setTilt(45);
      this.map.setZoom(Math.max(this.map.getZoom() || 12, 15));
    } else {
      this.map.setMapTypeId('roadmap');
      this.map.setTilt(0);
      // Reapply dark mode styles if needed
      const isDark = this.themeService.isDarkMode();
      this.map.setOptions({ styles: isDark ? this.darkMapStyles : [] });
    }
  }

  private loadGoogleMapsScript(): void {
    const scriptId = 'google-maps-js';

    // Already loaded and google.maps is ready?
    if (document.getElementById(scriptId) && typeof google !== 'undefined' && google.maps) {
      this.initMap();
      return;
    }

    // Remove any broken previous attempt
    const existing = document.getElementById(scriptId);
    if (existing) {
      existing.remove();
    }

    const script = document.createElement('script');
    script.id = scriptId;
    // Classic loading (no loading=async) — libraries declared in URL, used directly
    script.src = `https://maps.googleapis.com/maps/api/js?key=${this.googleMapsKey}&libraries=places,marker&language=fr&region=TN`;
    script.async = true;
    script.defer = true;
    script.onload = () => this.initMap();
    script.onerror = () => (this.scriptError = true);
    document.head.appendChild(script);
  }

  private async initMap(): Promise<void> {
    // Wait a tick for DOM & google.maps to be fully ready
    await new Promise(resolve => setTimeout(resolve, 200));

    const container = document.getElementById('google-map-container');
    if (!container) return;

    // Safety guard — make sure the API loaded correctly
    if (typeof google === 'undefined' || !google.maps) {
      console.error('Google Maps API non disponible.');
      this.scriptError = true;
      return;
    }

    try {
      // Classic approach: use constructors directly (no importLibrary needed)

      const isDark = this.themeService.isDarkMode();
      const defaultCenter = { lat: 36.8065, lng: 10.1815 };

      this.map = new google.maps.Map(container, {
        center: defaultCenter,
        zoom: 10,
        mapTypeId: 'roadmap',
        styles: isDark ? this.darkMapStyles : [],
        zoomControl: true,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        gestureHandling: 'greedy',
        clickableIcons: false,
      });

      // Geocoder for reverse geocoding
      this.geocoder = new google.maps.Geocoder();

      // Places Autocomplete (new PlaceAutocompleteElement API)
      const searchContainer = document.getElementById('search-container');
      if (searchContainer) {
        // @ts-ignore — PlaceAutocompleteElement is part of the new Places API
        this.autocompleteEl = new google.maps.places.PlaceAutocompleteElement({
          componentRestrictions: { country: ['tn'] },
          requestedLanguage: 'fr',
        });

        searchContainer.appendChild(this.autocompleteEl);

        this.autocompleteEl.addEventListener('gmp-placeselect', async (e: any) => {
          if (!e.place) return;
          await e.place.fetchFields({ fields: ['displayName', 'formattedAddress', 'location'] });
          if (e.place.location) {
            const lat = e.place.location.lat();
            const lng = e.place.location.lng();
            const address = e.place.formattedAddress || e.place.displayName || '';
            this.setLocation(lat, lng, address);
          }
        });
      }

      // Click on map to pick location
      this.map.addListener('click', (e: google.maps.MapMouseEvent) => {
        if (e.latLng) {
          this.reverseGeocode(e.latLng.lat(), e.latLng.lng());
        }
      });

      this.map.addListener('tilesloaded', () => {
        this.mapLoaded = true;
      });
    } catch (err) {
      console.error('Google Maps init error:', err);
      this.scriptError = true;
    }
  }

  private reverseGeocode(lat: number, lng: number): void {
    if (!this.geocoder) {
      this.setLocation(lat, lng, `${lat.toFixed(5)}, ${lng.toFixed(5)}`);
      return;
    }

    this.geocoder.geocode({ location: { lat, lng }, language: 'fr' }, (results: google.maps.GeocoderResult[] | null, status: google.maps.GeocoderStatus) => {
      if (status === 'OK' && results && results.length > 0) {
        this.setLocation(lat, lng, results[0].formatted_address);
      } else {
        this.setLocation(lat, lng, `${lat.toFixed(5)}, ${lng.toFixed(5)}`);
      }
    });
  }

  private setLocation(lat: number, lng: number, address: string): void {
    this.selectedLat = lat;
    this.selectedLng = lng;
    this.selectedAddress = address;

    this.addMarker(lat, lng);
    this.map?.panTo({ lat, lng });
    if ((this.map?.getZoom() || 0) < 14) {
      this.map?.setZoom(14);
    }
  }

  private addMarker(lat: number, lng: number): void {
    if (this.marker) {
      this.marker.setMap(null);
    }

    const svgData = `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#3b82f6"/>
      <circle cx="12" cy="9" r="2.5" fill="white"/>
    </svg>`;
    const iconUrl = 'data:image/svg+xml;base64,' + btoa(svgData);

    this.marker = new google.maps.Marker({
      position: { lat, lng },
      map: this.map!,
      icon: {
        url: iconUrl,
        anchor: new google.maps.Point(14, 28)
      },
      animation: google.maps.Animation.DROP
    });
  }

  confirmLocation(): void {
    if (this.selectedLat !== null && this.selectedLng !== null) {
      this.locationSelected.emit({
        address: this.selectedAddress,
        lat: this.selectedLat,
        lng: this.selectedLng,
      });
    }
  }

  close(): void {
    this.closed.emit();
  }

  ngOnDestroy(): void {
    this.map = null;
    this.marker = null;
    this.geocoder = null;
    this.autocompleteEl = null;
  }
}
