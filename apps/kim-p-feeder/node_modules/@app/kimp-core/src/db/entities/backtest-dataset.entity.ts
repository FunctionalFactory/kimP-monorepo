import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity()
export class BacktestDataset {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string; // 예: "ADA 6개월 1분봉 데이터"

  @Column({ nullable: true })
  description: string;

  @Column()
  originalFileName: string; // 예: "ada-1m.csv"

  @Column()
  storedFileName: string; // 서버에 저장될 고유한 파일명 (충돌 방지)

  @Column()
  filePath: string; // 서버 내 저장 경로 (예: /storage/datasets/...)

  @Column()
  fileSize: number; // 바이트 단위

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;
}
