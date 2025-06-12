import { Component } from '@angular/core';
import { MethodDrawComponent } from './method-draw.component';
@Component({
  selector: 'app-root',
  imports: [MethodDrawComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'mkdraw-wrap';
}
