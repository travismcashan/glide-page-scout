import { Badge } from '@/components/ui/badge';
import { Mail, Phone, Linkedin, Twitter, Github, MapPin, Clock, Globe } from 'lucide-react';
import { ApolloData } from './types';

export function ApolloContactSection({ data }: { data: ApolloData }) {
  return (
    <div>
      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Contact & Social</h4>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
        {data.email && (
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
            <a href={`mailto:${data.email}`} className="text-primary hover:underline truncate">{data.email}</a>
            {data.emailStatus && <Badge variant={data.emailStatus === 'verified' ? 'default' : 'secondary'} className="text-[10px] px-1.5 py-0">{data.emailStatus}</Badge>}
          </div>
        )}
        {data.personalEmails && data.personalEmails.length > 0 && data.personalEmails.map(pe => (
          <div key={pe} className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
            <a href={`mailto:${pe}`} className="text-primary hover:underline truncate">{pe}</a>
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">personal</Badge>
          </div>
        ))}
        {data.phone && (
          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
            <span>{data.phone}</span>
          </div>
        )}
        {data.linkedinUrl && (
          <div className="flex items-center gap-2">
            <Linkedin className="h-4 w-4 text-muted-foreground shrink-0" />
            <a href={data.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate">
              {data.linkedinUrl.replace(/https?:\/\/(www\.)?linkedin\.com\/in\//, '').replace(/\/$/, '')}
            </a>
          </div>
        )}
        {data.twitterUrl && (
          <div className="flex items-center gap-2">
            <Twitter className="h-4 w-4 text-muted-foreground shrink-0" />
            <a href={data.twitterUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate">{data.twitterUrl.replace(/https?:\/\/(www\.)?twitter\.com\//, '@')}</a>
          </div>
        )}
        {data.githubUrl && (
          <div className="flex items-center gap-2">
            <Github className="h-4 w-4 text-muted-foreground shrink-0" />
            <a href={data.githubUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate">{data.githubUrl.replace(/https?:\/\/(www\.)?github\.com\//, '')}</a>
          </div>
        )}
        {data.facebookUrl && (
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
            <a href={data.facebookUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate">Facebook</a>
          </div>
        )}
        {(data.city || data.state || data.country) && (
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
            <span>{data.formattedAddress || [data.streetAddress, data.city, data.state, data.postalCode, data.country].filter(Boolean).join(', ')}</span>
          </div>
        )}
        {data.timeZone && (
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
            <span>{data.timeZone}</span>
          </div>
        )}
      </div>

      {/* Email & engagement signals */}
      {(data.emailSource || data.emailTrueStatus || data.extrapolatedEmailConfidence != null || data.emailDomainCatchall != null || data.freeDomain != null || data.isLikelyToEngage != null) && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {data.emailSource && <Badge variant="outline" className="text-[10px]">Source: {data.emailSource}</Badge>}
          {data.emailTrueStatus && <Badge variant="outline" className="text-[10px]">True status: {data.emailTrueStatus}</Badge>}
          {data.extrapolatedEmailConfidence != null && <Badge variant="outline" className="text-[10px]">Email confidence: {data.extrapolatedEmailConfidence}</Badge>}
          {data.emailDomainCatchall === true && <Badge variant="destructive" className="text-[10px]">Catch-all domain</Badge>}
          {data.freeDomain === true && <Badge variant="secondary" className="text-[10px]">Free email domain</Badge>}
          {data.isLikelyToEngage === true && <Badge variant="default" className="text-[10px]">Likely to engage</Badge>}
          {data.isLikelyToEngage === false && <Badge variant="outline" className="text-[10px]">Not likely to engage</Badge>}
        </div>
      )}
    </div>
  );
}
