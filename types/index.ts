export interface PersonOffice {
  office: string
  telNo: string
  mobileNo: string
  officeUrl: string
  mobileNoTitle: string
  telNoTitle: string
}

export interface PersonFocus {
  node: string
}

export interface Person {
  id: string | null
  imgUrl: string
  firstName: string
  lastName: string | null
  jobTitle: string
  associateFirms: string
  officeDetails?: string
  officeTitle?: string
  languages: string
  practices: string
  email?: string
  emailMeAddress?: string
  profileUrl?: string
  link?: string
  about?: string
  officeList?: PersonOffice[]
  focusList?: PersonFocus[]
  expandOfficeHeading?: string
  expandAOF?: string
  expandVFP?: string
}

export interface SearchResponse {
  totalResult: number
  persons: Person[]
}
