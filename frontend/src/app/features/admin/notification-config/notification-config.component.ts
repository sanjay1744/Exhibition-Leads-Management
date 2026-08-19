import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-notification-config',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './notification-config.component.html',
  styleUrl: './notification-config.component.css'
})
export class NotificationConfigComponent {}
