import {Component} from '@angular/core';
import {ExampleTypeLabels, ExampleTypes} from '../../model/Example'
import {FormsModule} from '@angular/forms'
import {NgForOf} from '@angular/common'
import {MatFormField, MatLabel} from '@angular/material/input'
import {MatSelect} from '@angular/material/select'
import {MatOption} from '@angular/material/core'

@Component({
  selector: 'app-create-example',
  imports: [
    FormsModule,
    MatFormField,
    MatLabel,
    MatSelect,
    MatOption,
    NgForOf
  ],
  templateUrl: './create-example.component.html',
  standalone: true,
  styleUrl: './create-example.component.scss'
})
export class CreateExampleComponent {
  selectedExampleType: ExampleTypes = ExampleTypes.OPEN;

  exampleTypes = Object.values(ExampleTypes).filter(v => typeof v === 'number');
  ExampleTypeLabels = ExampleTypeLabels;
}
