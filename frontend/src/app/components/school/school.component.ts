import {Component, inject} from '@angular/core';
import {ActivatedRoute} from '@angular/router'
import {HttpService} from '../../service/http.service'
import {SchoolDTO} from '../../model/School'

@Component({
  selector: 'app-school',
  imports: [],
  templateUrl: './school.component.html',
  standalone: true,
  styleUrl: './school.component.scss'
})
export class SchoolComponent {
  service = inject(HttpService)

  school:SchoolDTO = {} as SchoolDTO

  schoolId: string | null = null;

  constructor(private route: ActivatedRoute) {
    this.route.paramMap.subscribe(params => {
      this.schoolId = params.get('id');

      this.service.getSchoolById(this.schoolId!).subscribe(school => {
        this.school = school;
      })
    });
  }
}
