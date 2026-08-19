import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-notification-logs',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './notification-logs.component.html',
  styleUrl: './notification-logs.component.css'
})
export class NotificationLogsComponent {}
