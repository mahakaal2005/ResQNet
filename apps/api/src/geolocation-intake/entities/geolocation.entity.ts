import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('geolocations')
export class Geolocation {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'detection_id' })
  detectionId!: string;

  @Column({ type: 'float' })
  latitude!: number;

  @Column({ type: 'float' })
  longitude!: number;

  @Column({ name: 'error_m', type: 'float' })
  errorM!: number;

  @Column()
  method!: string;

  // PostGIS point kept in sync with latitude/longitude for geo-proximity queries.
  @Column({
    type: 'geometry',
    spatialFeatureType: 'Point',
    srid: 4326,
    nullable: true,
  })
  location!: { type: 'Point'; coordinates: [number, number] } | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
